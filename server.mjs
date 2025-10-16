import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import canvas from 'canvas';
import { loadImage } from 'canvas';  
import * as faceapi from 'face-api.js';
import mysql from 'mysql2/promise';
import axios from 'axios';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';
import cors from "cors";
import Redis from "ioredis";

dotenv.config();

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ fetch, Canvas, Image, ImageData });

const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'toor',
  database: 'vitgtk'
});

const redis = new Redis();
const app = express();
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());
app.use(fileUpload());
app.use(cors());

app.use('/files', express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

const port = 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index1.html'));
});

app.get('/events-dates', async (req, res) => {
    try {
        const [results] = await db.execute(
            'SELECT event_date, COUNT(*) as event_count FROM events GROUP BY event_date ORDER BY event_date DESC'
        );
        
        const datesWithCount = results.map(row => {
            const dateObj = new Date(row.event_date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            console.log('Дата события:', {
                original: row.event_date,
                converted: dateStr,
                year, month, day
            });
            
            return {
                date: dateStr, 
                count: row.event_count
            };
        });
        
        console.log('Даты с событиями (исправленные):', datesWithCount);
        res.json(datesWithCount);
    } catch (err) {
        console.error('Ошибка получения дат событий:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


app.get('/events-range', async (req, res) => {
    try {
        const { start, end } = req.query;
        console.log('Запрос событий за период:', start, 'до', end);
        
        const [results] = await db.execute(
            'SELECT * FROM events WHERE event_date BETWEEN ? AND ? ORDER BY event_date DESC, events_id DESC',
            [start, end]
        );
        
        console.log(`Найдено событий за период: ${results.length}`);
        res.json(results);
    } catch (err) {
        console.error('Ошибка получения событий по диапазону:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
app.get('/last-event', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM events ORDER BY event_date DESC, events_id DESC LIMIT 1');
    if (results.length === 0) {
      return res.status(404).json({ error: 'События не найдены' });
    }
    console.log('Последнее событие:', results[0]);
    res.json(results[0]);
  } catch (err) {
    console.error('Ошибка получения последнего события:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/events/:date', async (req, res) => {
    const selectedDate = req.params.date; 
    try {
        console.log('Запрос событий на дату:', selectedDate);
        
        const [results] = await db.execute(
            'SELECT * FROM events WHERE DATE(event_date) = ? ORDER BY events_id DESC', 
            [selectedDate]
        );
        
        console.log(`Найдено событий на дату ${selectedDate}:`, results.length);
        res.json(results);
    } catch (err) {
        console.error('Ошибка выполнения SQL-запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/events/:events_id/images', async (req, res) => {
  const eventID = req.params.events_id;
  try {
    const [results] = await db.execute('SELECT img_id, image AS imageUrl FROM img WHERE event_id = ?', [eventID]);
    
    if (results.length === 0) {
      return res.json([]);
    }

    const processedResults = results.map(image => {
      return {
        ...image,
        imageUrl: `/files/${image.imageUrl}`
      };
    });

    res.json(processedResults);

  } catch (err) {
    console.error('Ошибка получения изображений:', err);
    res.status(500).send({ error: 'Ошибка получения изображений' });
  }
});

app.get('/search-events', async (req, res) => {
    try {
        const query = req.query.q;
        console.log('Поисковый запрос:', query);
        
        if (!query || query.trim().length < 3) {
            return res.json([]);
        }

        const searchQuery = `%${query}%`;
        const [results] = await db.execute(
            'SELECT events_id, name FROM events WHERE name LIKE ? ORDER BY event_date DESC LIMIT 10',
            [searchQuery]
        );
        
        console.log('Результаты поиска:', results);
        res.json(results);
    } catch (err) {
        console.error('Ошибка поиска событий:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/event/:id', async (req, res) => {
  const eventID = req.params.id;
  try {
    const [results] = await db.execute('SELECT * FROM events WHERE events_id = ?', [eventID]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('Ошибка получения события:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'models'));
    console.log('Модели face-api загружены успешно');
  } catch (error) {
    console.error('Ошибка загрузки модели:', error);
  }
}

await loadModels();

async function loadImageFromPath(imagePath) {
  try {
    const fileName = imagePath.includes('/') ? imagePath.split('/').pop() : imagePath;
    
    const possiblePaths = [
      path.join(__dirname, fileName),
      path.join(__dirname, 'uploads', fileName),
      path.join(__dirname, 'images', fileName),
    ];

    let foundPath = null;
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        foundPath = testPath;
        break;
      } catch (e) {
      }
    }

    if (!foundPath) {
      throw new Error(`Изображение не найдено: ${fileName}`);
    }

    const imageBuffer = await fs.readFile(foundPath);
    const img = await loadImage(imageBuffer);
    return img;

  } catch (err) {
    console.error('Ошибка загрузки изображения:', err);
    throw err;
  }
}

async function computeAndSaveClientDescriptors(clientId) {
  try {
    console.log(`Вычисляем дескрипторы для клиента ${clientId}`);
    
    const [clientImages] = await db.execute(
      'SELECT image FROM client_images WHERE client_id = ?',
      [clientId]
    );

    if (clientImages.length === 0) {
      console.log(`Нет изображений для клиента ${clientId}`);
      return [];
    }

    const descriptors = [];

    for (const img of clientImages) {
      try {
        const image = await loadImageFromPath(img.image);
        const detection = await faceapi.detectSingleFace(image)
          .withFaceLandmarks()
          .withFaceDescriptor();
        
        if (detection) {
          const descriptorArray = Array.from(detection.descriptor);
          descriptors.push(descriptorArray);
          
          await db.execute(
            'INSERT INTO client_face_descriptors (client_id, descriptor) VALUES (?, ?)',
            [clientId, JSON.stringify(descriptorArray)]
          );
          
          console.log(`Сохранен дескриптор для клиента ${clientId}`);
        }
      } catch (error) {
        console.warn(`Ошибка обработки изображения клиента ${clientId}:`, error.message);
      }
    }

    return descriptors;
  } catch (error) {
    console.error('Ошибка вычисления дескрипторов клиента:', error);
    return [];
  }
}

async function computeAndSaveEventDescriptors(imgId) {
  try {
    console.log(`Вычисляем дескрипторы для изображения события ${imgId}`);
    
    const [eventImages] = await db.execute(
      'SELECT image FROM img WHERE img_id = ?',
      [imgId]
    );

    if (eventImages.length === 0) {
      console.log(`Изображение не найдено для img_id ${imgId}`);
      return [];
    }

    const descriptors = [];

    try {
      const image = await loadImageFromPath(eventImages[0].image);
      const detections = await faceapi.detectAllFaces(image)
        .withFaceLandmarks()
        .withFaceDescriptors();

      for (const detection of detections) {
        const descriptorData = Array.from(detection.descriptor);
        
        const box = detection.detection.box;
        const boxData = {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        };
        
        descriptors.push({
          descriptor: descriptorData,
          detection: {
            _box: boxData,
            descriptor: descriptorData
          }
        });

        await db.execute(
          'INSERT INTO event_face_descriptors (img_id, descriptor, face_box) VALUES (?, ?, ?)',
          [imgId, JSON.stringify(descriptorData), JSON.stringify(boxData)]
        );
        
        console.log(`Сохранен дескриптор для изображения события ${imgId}`);
      }
    } catch (error) {
      console.error('Ошибка обработки изображения события:', error);
    }

    return descriptors;
  } catch (error) {
    console.error('Ошибка вычисления дескрипторов события:', error);
    return [];
  }
}

async function getClientDescriptors(clientId) {
  try {
    const [dbDescriptors] = await db.execute(
      'SELECT descriptor FROM client_face_descriptors WHERE client_id = ?',
      [clientId]
    );

    if (dbDescriptors.length > 0) {
      console.log(`Дескрипторы клиента ${clientId} найдены в БД`);
      const descriptors = [];
      for (const row of dbDescriptors) {
        try {
          let descriptorData = row.descriptor;
          
          if (typeof descriptorData === 'string') {
            descriptorData = JSON.parse(descriptorData);
          }
          
          descriptors.push(descriptorData);
        } catch (parseError) {
          console.warn(`Ошибка парсинга дескриптора клиента ${clientId}:`, parseError.message);
          console.warn('Проблемные данные:', row.descriptor?.substring(0, 100));
        }
      }
      return descriptors;
    } else {
      console.log(`Дескрипторы клиента ${clientId} не найдены в БД, вычисляем...`);
      return await computeAndSaveClientDescriptors(clientId);
    }
  } catch (error) {
    console.error('Ошибка получения дескрипторов клиента:', error);
    return [];
  }
}

async function getEventDescriptors(imgId) {
  try {
    const [dbDescriptors] = await db.execute(
      'SELECT descriptor, face_box FROM event_face_descriptors WHERE img_id = ?',
      [imgId]
    );

    if (dbDescriptors.length > 0) {
      console.log(`Дескрипторы события ${imgId} найдены в БД`);
      const descriptors = [];
      for (const row of dbDescriptors) {
        try {
          let descriptorData = row.descriptor;
          let faceBoxData = row.face_box;
          
          if (typeof descriptorData === 'string') {
            descriptorData = JSON.parse(descriptorData);
          }
          if (typeof faceBoxData === 'string') {
            faceBoxData = JSON.parse(faceBoxData);
          }
          
          descriptors.push({
            descriptor: descriptorData,
            detection: { 
              _box: faceBoxData,
              descriptor: new Float32Array(descriptorData)
            }
          });
        } catch (parseError) {
          console.warn(`Ошибка парсинга дескриптора события ${imgId}:`, parseError.message);
          console.warn('Проблемные данные:', {
            descriptor: row.descriptor?.substring(0, 100),
            face_box: row.face_box?.substring(0, 100)
          });
        }
      }
      return descriptors;
    } else {
      console.log(`Дескрипторы события ${imgId} не найдены в БД, вычисляем...`);
      return await computeAndSaveEventDescriptors(imgId);
    }
  } catch (error) {
    console.error('Ошибка получения дескрипторов события:', error);
    return [];
  }
}

app.get("/compare-event-faces/:imgId", async (req, res) => {
  try {
    const { imgId } = req.params;
    console.log('Запрос на сравнение для imgId:', imgId);

    const cacheKey = `face-matches:${imgId}`;
    const cachedResult = await redis.get(cacheKey);

    if (cachedResult) {
      console.log("Отправляем кэшированный результат");
      return res.json(JSON.parse(cachedResult));
    }

    const eventDescriptors = await getEventDescriptors(imgId);
    if (eventDescriptors.length === 0) {
      console.log('Дескрипторы не найдены для изображения');
      return res.json([]);
    }

    const [clients] = await db.execute("SELECT clients_id, name FROM clients");
    const matches = [];

    for (const client of clients) {
      const clientDescriptors = await getClientDescriptors(client.clients_id);
      
      if (clientDescriptors.length === 0) {
        console.log(`Нет дескрипторов для клиента ${client.name}`);
        continue;
      }

      for (const eventFace of eventDescriptors) {
        let bestDistance = Infinity;
        let bestClientDescriptor = null;
        
        for (const clientDescriptor of clientDescriptors) {
          const distance = faceapi.euclideanDistance(
            eventFace.detection.descriptor,
            new Float32Array(clientDescriptor)
          );
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestClientDescriptor = clientDescriptor;
          }
        }

        const THRESHOLD = 0.4;
        if (bestDistance < THRESHOLD) {
          console.log(`Совпадение: ${client.name} (дистанция: ${bestDistance.toFixed(4)})`);
          matches.push({
            detection: eventFace.detection,
            name: client.name,
            clientId: client.clients_id,
            distance: bestDistance
          });
        }
      }
    }

    await redis.setex(cacheKey, 10800, JSON.stringify(matches));
    console.log(`Итоговые совпадения: ${matches.length}`);
    res.json(matches);

  } catch (error) {
    console.error("Ошибка при сравнении лиц:", error);
    res.status(500).json({ error: "Ошибка сервера при сравнении лиц" });
  }
});

app.get('/clients/:clientId', async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const [rows] = await db.execute('SELECT * FROM clients WHERE clients_id = ?', [clientId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Ошибка при получении данных клиента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/clients', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT clients_id, name, image, group_cl FROM clients');
    res.json(rows);
  } catch (error) {
    console.error('Ошибка при получении списка клиентов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(port, (err) => {
  if (err) {
    console.error(`Ошибка запуска сервера: ${err}`);
  } else {
    console.log(`Сервер запущен на http://127.0.0.1:${port}`);
  }
});