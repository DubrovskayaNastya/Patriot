document.addEventListener('DOMContentLoaded', async function () {
    let eventDates = [];
    
    async function loadEventDates() {
        try {
            const response = await fetch('/events-dates');
            eventDates = await response.json();
            console.log('Даты с событиями и количеством:', eventDates);
            initializeCalendar();
        } catch (error) {
            console.error('Ошибка загрузки дат событий:', error);
        }
    }

    function initializeCalendar() {
        const calendarContainer = document.getElementById('calendar');
        if (calendarContainer) {
            calendarContainer.style.width = '100%';
            calendarContainer.style.height = '100%';
        }

        $('#calendar').fullCalendar({
            header: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            editable: false,
            eventLimit: false,
            contentHeight: 'auto',
            aspectRatio: 1.5,
            locale: 'ru',
            firstDay: 1,
            timeZone: 'local',
            monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
            monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
            dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
            dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
            buttonText: {
                today: 'сегодня',
                month: 'месяц',
                week: 'неделя',
                day: 'день'
            },
            events: [],
            dayRender: function(date, cell) {
                const dateStr = date.format('YYYY-MM-DD');
                
                cell.removeClass('has-event');
                
                const eventDate = eventDates.find(d => {
                    console.log('Сравниваем:', {
                        serverDate: d.date,
                        cellDate: dateStr,
                        equals: d.date === dateStr
                    });
                    return d.date === dateStr;
                });
                
                if (eventDate) {
                    cell.addClass('has-event');
                    console.log('Найдено событие для даты:', dateStr, eventDate);
                } else {
                    console.log('Нет события для даты:', dateStr);
                }
            },
            dayClick: function (date) {
                const dateStr = date.format('YYYY-MM-DD');
                
                console.log('Клик по дате:', dateStr);
                
                fetch(`/events/${dateStr}`)
                    .then(response => response.json())
                    .then(events => {
                        const eventDetails = document.getElementById('event-details');
            
                        if (events.length > 0) {
                            eventDetails.innerHTML = createEventSlider(events);
                            eventDetails.classList.add('active');
                            
                            if (events.length > 0) {
                                loadEventImages(events[0].events_id, `image-slider-0`);
                            }
                        } else {
                            eventDetails.innerHTML = '<div class="no-events">Нет событий на эту дату</div>';
                            eventDetails.classList.add('active');
                        }
                    })
                    .catch(error => console.error('Ошибка получения события:', error));
            },
            viewRender: function(view) {
                setTimeout(() => {
                    $('.fc-view-container').css('height', 'auto');
                }, 100);
            }
        });

        setTimeout(() => {
            $('#calendar').fullCalendar('render');
        }, 500);

        loadLastEvent();
    }

    async function loadLastEvent() {
        try {
            const response = await fetch('/last-event');
            const event = await response.json();
            
            if (event && !event.error) {
                const eventDetails = document.getElementById('event-details');
                eventDetails.innerHTML = createEventSlider([event]);
                eventDetails.classList.add('active');
                
                loadEventImages(event.events_id, `image-slider-0`);
            } else {
                const eventDetails = document.getElementById('event-details');
                eventDetails.innerHTML = '<div class="no-events">Нет событий для отображения</div>';
                eventDetails.classList.add('active');
            }
        } catch (error) {
            console.error('Ошибка загрузки последнего события:', error);
        }
    }

    function createEventSlider(events) {
        let content = '<div class="event-slider">';

        events.forEach((event, index) => {
            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleDateString('ru-RU');
            
            content += `
                <div class="event-slide" data-index="${index}" style="display: ${index === 0 ? 'block' : 'none'};">
                    <div class="event-header">
                        <h3 class="event-title">${event.name}</h3>
                        <div class="event-date">${formattedDate}</div>
                    </div>
                    <p class="event-about">${event.about || 'Описание отсутствует'}</p>
                    <div id="image-slider-${index}" class="image-slider-container">
                        <div class="image-loading">Загрузка изображений...</div>
                    </div>
                </div>`;
        });

        if (events.length > 1) {
            content += `
                <div class="event-navigation">
                    <button id="prev-event" class="event-nav-btn prev-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <div class="event-counter">
                        <span class="current-event">1</span>
                        <span class="counter-separator">/</span>
                        <span class="total-events">${events.length}</span>
                    </div>
                    <button id="next-event" class="event-nav-btn next-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                </div>
            `;
        }

        content += '</div>';
        
        setTimeout(() => {
            if (events.length > 1) {
                initializeEventSlider(events);
            }
        }, 100);
        
        return content;
    }

    async function loadEventImages(eventId, containerId) {
        try {
            const response = await fetch(`/events/${eventId}/images`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const images = await response.json();
            
            const imageContainer = document.getElementById(containerId);
            if (!imageContainer) {
                console.error('Контейнер не найден:', containerId);
                return;
            }

            if (images.length === 0) {
                imageContainer.innerHTML = '<div class="no-images">Нет изображений для этого события</div>';
                return;
            }

            let content = '<div class="sl-container">';
            
            images.forEach((img, index) => {
                content += `
                    <div class="sl-image-slide" data-index="${index}" style="display: ${index === 0 ? 'flex' : 'none'};">
                        <div class="image-wrapper">
                            <img src="${img.imageUrl}" class="sl-image" alt="Событие" 
                                 id="image-${img.img_id}" data-img-id="${img.img_id}"
                                 onload="handleImageLoad(this)"
                                 onerror="handleImageError(this)">
                            <div class="image-fallback" style="display: none;">
                                <div class="placeholder-image">
                                    <div class="placeholder-icon">📷</div>
                                    <p>Изображение не найдено</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';

            if (images.length > 1) {
                content += `
                    <button class="sl-btn sl-prev">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                    <button class="sl-btn sl-next">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                    <div class="sl-counter">1 / ${images.length}</div>
                `;
            }

            imageContainer.innerHTML = content;
            
            if (images.length > 1) {
                initializeImageSlider(containerId, images.length);
            }
            
            setTimeout(() => {
                images.forEach((img, index) => {
                    const imgElement = document.getElementById(`image-${img.img_id}`);
                    if (imgElement && imgElement.complete) {
                        handleImageLoad(imgElement);
                    }
                });
            }, 500);
            
        } catch (error) {
            console.error('Ошибка загрузки изображений:', error);
            const imageContainer = document.getElementById(containerId);
            if (imageContainer) {
                imageContainer.innerHTML = '<div class="error-message">Ошибка загрузки изображений</div>';
            }
        }
    }

    window.handleImageLoad = function(imgElement) {
        const imgId = imgElement.getAttribute('data-img-id');
        if (imgId) {
            setTimeout(() => {
                initializeFaceHoverForImage(imgElement);
            }, 100);
        }
    };

    window.handleImageError = function(imgElement) {
        const fallback = imgElement.parentElement.querySelector('.image-fallback');
        if (fallback) {
            fallback.style.display = 'flex';
        }
        imgElement.style.display = 'none';
    };

    function initializeFaceHoverForImage(imgElement) {
        imgElement.removeEventListener('mouseenter', handleImageHover);
        imgElement.removeEventListener('mouseleave', handleImageLeave);
        imgElement.removeEventListener('click', handleImageClick);
        
        imgElement.addEventListener('mouseenter', handleImageHover);
        imgElement.addEventListener('mouseleave', handleImageLeave);
        imgElement.addEventListener('click', handleImageClick);
    }

    async function handleImageHover(event) {
    const imgElement = event.target;
    const imgId = imgElement.getAttribute('data-img-id');
    
    if (!imgId) return;

    if (imgElement._lastHoverTime && Date.now() - imgElement._lastHoverTime < 1000) {
        return;
    }
    imgElement._lastHoverTime = Date.now();

    try {
        console.log('Запрос сравнения лиц для imgId:', imgId);
        const response = await fetch(`/compare-event-faces/${imgId}`, {
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            console.warn('Сервер вернул ошибку:', response.status);
            return;
        }
        
        const matches = await response.json();
        
        if (Array.isArray(matches) && matches.length > 0) {
            const validMatches = matches.filter(match => match.name && match.name !== "Неизвестный");
            
            if (validMatches.length > 0) {
                console.log('Найдены совпадения:', validMatches.length);
                drawFaceBox(imgElement, validMatches);
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('Запрос сравнения лиц отменен по таймауту');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.warn('Проблема с сетью при запросе сравнения лиц');
        } else {
            console.error('Ошибка при сравнении лиц:', error);
        }
    }
}

function handleImageLeave(event) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && relatedTarget.classList.contains('name-label')) {
        return;
    }
    
    const imgElement = event.target;
    const container = imgElement.parentElement;
    if (container && !container.contains(relatedTarget)) {
        clearFaceBox(imgElement);
    }
}

async function handleImageClick(event) {
    const imgElement = event.target;
    const imgId = imgElement.getAttribute('data-img-id');
    
    if (!imgId) return;

    try {
        console.log('Клик - запрос сравнения лиц для imgId:', imgId);
        const response = await fetch(`/compare-event-faces/${imgId}`, {
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            console.warn('Сервер вернул ошибку:', response.status);
            return;
        }
        
        const matches = await response.json();
        
        if (Array.isArray(matches) && matches.length > 0) {
            const validMatches = matches.filter(match => match.name && match.name !== "Неизвестный");
            
            if (validMatches.length > 0) {
                console.log('Клик - найдены совпадения:', validMatches.length);
                drawFaceBox(imgElement, validMatches);
                
                setTimeout(() => {
                    clearFaceBox(imgElement);
                }, 5000);
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('Запрос сравнения лиц отменен по таймауту');
        } else {
            console.error('Ошибка при сравнении лиц по клику:', error);
        }
    }
}


    function drawFaceBox(imgElement, matches) {
        clearFaceBox(imgElement);

        const canvas = document.createElement("canvas");
        canvas.classList.add("face-canvas");
        
        const container = imgElement.parentElement;
        const containerRect = container.getBoundingClientRect();
        canvas.width = containerRect.width;
        canvas.height = containerRect.height;
        
        canvas.style.position = "absolute";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "10";

        const ctx = canvas.getContext("2d");
        
        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;
        
        if (naturalWidth === 0 || naturalHeight === 0) {
            return;
        }

        const displayedWidth = containerRect.width;
        const displayedHeight = containerRect.height;
        
        const imgAspect = naturalWidth / naturalHeight;
        const containerAspect = displayedWidth / displayedHeight;
        
        let renderableWidth, renderableHeight, xStart, yStart;
        
        if (imgAspect > containerAspect) {
            renderableWidth = displayedWidth;
            renderableHeight = displayedWidth / imgAspect;
            xStart = 0;
            yStart = (displayedHeight - renderableHeight) / 2;
        } else {
            renderableHeight = displayedHeight;
            renderableWidth = displayedHeight * imgAspect;
            xStart = (displayedWidth - renderableWidth) / 2;
            yStart = 0;
        }

        const scaleX = renderableWidth / naturalWidth;
        const scaleY = renderableHeight / naturalHeight;

        ctx.strokeStyle = "#ff4444";
        ctx.fillStyle = "rgba(255, 68, 68, 0.1)";
        ctx.lineWidth = 3;

        const uniquePersons = new Map();

        matches.forEach(match => {
            if (!match.detection || !match.detection._box) {
                return;
            }

            const { name, detection, distance } = match;
            const box = detection._box;
            
            const x = box._x || box.x;
            const y = box._y || box.y;
            const width = box._width || box.width;
            const height = box._height || box.height;
            
            if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
                return;
            }
            
            if (uniquePersons.has(name)) {
                const existingMatch = uniquePersons.get(name);
                if (distance < existingMatch.distance) {
                    uniquePersons.set(name, { ...match, x, y, width, height });
                }
            } else {
                uniquePersons.set(name, { ...match, x, y, width, height });
            }
        });

        const namesContainer = document.createElement("div");
        namesContainer.classList.add("names-container");
        namesContainer.style.position = "absolute";
        namesContainer.style.left = "0";
        namesContainer.style.top = "0";
        namesContainer.style.width = "100%";
        namesContainer.style.height = "100%";
        namesContainer.style.pointerEvents = "none";
        namesContainer.style.zIndex = "11";

        uniquePersons.forEach((match) => {
            const { name, x, y, width, height } = match;

            const scaledX = x * scaleX + xStart;
            const scaledY = y * scaleY + yStart;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            if (isNaN(scaledX) || isNaN(scaledY) || isNaN(scaledWidth) || isNaN(scaledHeight) ||
                scaledWidth <= 0 || scaledHeight <= 0) {
                return;
            }

            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

            const nameLabel = document.createElement("div");
            nameLabel.classList.add("name-label");
            nameLabel.innerText = name;
            nameLabel.style.position = "absolute";
            nameLabel.style.left = `${scaledX}px`;
            nameLabel.style.top = `${Math.max(scaledY - 25, 5)}px`;
            nameLabel.style.color = "#ff4444";
            nameLabel.style.cursor = "pointer";
            nameLabel.style.zIndex = "12";
            nameLabel.style.background = "rgba(255,255,255,0.95)";
            nameLabel.style.padding = "6px 10px";
            nameLabel.style.borderRadius = "6px";
            nameLabel.style.fontSize = "12px";
            nameLabel.style.fontWeight = "600";
            nameLabel.style.border = "2px solid #ff4444";
            nameLabel.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
            nameLabel.style.whiteSpace = "nowrap";
            nameLabel.style.backdropFilter = "blur(4px)";
            
            nameLabel.style.pointerEvents = "auto";
            nameLabel.style.transition = "none";
            nameLabel.style.transform = "none";

            nameLabel.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (match.clientId) {
                    window.location.href = `index2.html?clientId=${match.clientId}`;
                }
            });

            nameLabel.addEventListener("mouseenter", (e) => {
                e.stopPropagation();
            });

            nameLabel.addEventListener("mouseleave", (e) => {
                e.stopPropagation();
            });

            namesContainer.appendChild(nameLabel);
        });

        container.appendChild(canvas);
        container.appendChild(namesContainer);
    }

    function clearFaceBox(imgElement) {
        const parent = imgElement.parentElement;
        if (parent) {
            parent.querySelectorAll(".face-canvas").forEach(canvas => canvas.remove());
            parent.querySelectorAll(".names-container").forEach(container => container.remove());
        }
    }

    function initializeImageSlider(sliderId, totalSlides) {
        const sliderElement = document.getElementById(sliderId);
        if (!sliderElement || totalSlides <= 1) return;

        const slides = sliderElement.querySelectorAll('.sl-image-slide');
        const prevBtn = sliderElement.querySelector('.sl-prev');
        const nextBtn = sliderElement.querySelector('.sl-next');
        const counter = sliderElement.querySelector('.sl-counter');
        let index = 0;

        function showSlide(i) {
            slides.forEach((slide, idx) => {
                slide.style.display = idx === i ? 'flex' : 'none';
            });
            
            if (counter) {
                counter.textContent = `${i + 1} / ${totalSlides}`;
            }
            
            const currentSlide = slides[i];
            const img = currentSlide.querySelector('img');
            if (img) {
                clearFaceBox(img);
            }
        }

        nextBtn.addEventListener('click', () => {
            index = (index + 1) % totalSlides;
            showSlide(index);
        });

        prevBtn.addEventListener('click', () => {
            index = (index - 1 + totalSlides) % totalSlides;
            showSlide(index);
        });

        showSlide(index);
    }

    function initializeEventSlider(events) {
        const slides = document.querySelectorAll('.event-slide');
        const prevBtn = document.getElementById('prev-event');
        const nextBtn = document.getElementById('next-event');
        const counter = document.querySelector('.event-counter');
        const currentSpan = counter.querySelector('.current-event');
        const totalSpan = counter.querySelector('.total-events');
        
        let currentIndex = 0;

        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.style.display = i === index ? 'block' : 'none';
            });
            
            currentSpan.textContent = index + 1;
            totalSpan.textContent = events.length;
            
            const currentEvent = events[index];
            const imageContainer = document.getElementById(`image-slider-${index}`);
            
            if (imageContainer && imageContainer.querySelector('.image-loading')) {
                loadEventImages(currentEvent.events_id, `image-slider-${index}`);
            }
        }

        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % events.length;
            showSlide(currentIndex);
        });

        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + events.length) % events.length;
            showSlide(currentIndex);
        });

        showSlide(currentIndex);
    }

    function initializeSearch() {
        const searchInput = document.getElementById('search-input');
        const suggestionsList = document.getElementById('suggestions-list');
        
        if (!searchInput || !suggestionsList) return;

        let searchTimeout;

        searchInput.addEventListener('input', function () {
            const query = this.value.trim();
            
            clearTimeout(searchTimeout);
            
            if (query.length < 3) {
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/search-events?q=${encodeURIComponent(query)}`);
                    const events = await response.json();

                    if (events.length > 0) {
                        suggestionsList.innerHTML = events.map(event =>
                            `<li data-id="${event.events_id}" class="suggestion-item">
                                <div class="suggestion-title">${event.name}</div>
                            </li>`
                        ).join('');
                        suggestionsList.style.display = 'block';
                    } else {
                        suggestionsList.innerHTML = '<li class="no-results">События не найдены</li>';
                        suggestionsList.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Ошибка загрузки подсказок:', error);
                    suggestionsList.innerHTML = '<li class="error">Ошибка поиска</li>';
                    suggestionsList.style.display = 'block';
                }
            }, 300);
        });

        suggestionsList.addEventListener('click', async function (event) {
            const listItem = event.target.closest('.suggestion-item');
            if (listItem) {
                const eventId = listItem.dataset.id;

                try {
                    const response = await fetch(`/event/${eventId}`);
                    const eventData = await response.json();

                    if (eventData.error) {
                        alert('Событие не найдено');
                        return;
                    }

                    const eventDetails = document.getElementById('event-details');
                    if (eventData) {
                        eventDetails.innerHTML = createEventSlider([eventData]);
                        eventDetails.classList.add('active');
                        
                        loadEventImages(eventData.events_id, `image-slider-0`);
                    }

                    searchInput.value = '';
                    suggestionsList.innerHTML = '';
                    suggestionsList.style.display = 'none';
                } catch (error) {
                    console.error('Ошибка загрузки события:', error);
                    alert('Ошибка загрузки события');
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (!searchInput.contains(event.target) && !suggestionsList.contains(event.target)) {
                suggestionsList.style.display = 'none';
            }
        });

        searchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                suggestionsList.style.display = 'none';
            }
        });
    }

    initializeSearch();
    await loadEventDates();
});


const styles = `
    #calendar-container {
        position: absolute;
        top: 150px;
        left: 30px;
        width: 43%;
        height: 53vh;
        float: left;
        padding: 20px;
        background-color: #fafafa;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        box-sizing: border-box;
        overflow: hidden;
        border-radius: 8px;
    }

    #calendar {
        width: 100% !important;
        height: 100% !important;
        position: relative !important;
        background: white;
        border-radius: 8px;
        padding: 10px;
        box-sizing: border-box;
    }

    .fc {
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        font-size: 14px !important;
    }

    .fc-toolbar {
        padding: 10px 0 !important;
        margin-bottom: 10px !important;
        height: 50px !important;
    }

    .fc-toolbar h2 {
        font-size: 18px !important;
        margin: 0 !important;
        line-height: 1.2 !important;
        font-weight: 600 !important;
    }

    .fc-button {
        padding: 6px 12px !important;
        font-size: 14px !important;
        height: auto !important;
        line-height: 1.2 !important;
    }

    .fc-day-header {
        padding: 8px 2px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        text-align: center !important;
    }

    .fc-day {
        border: 1px solid #e2e8f0 !important;
        position: relative;
        min-height: 80px !important;
        padding: 4px !important;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .fc-day:hover {
        background-color: #f7fafc !important;
    }

    .fc-day.fc-today {
        background-color: #f0fff4 !important;
    }

    .fc-day-number {
        float: left !important;
        margin: 6px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 1;
        position: relative;
    }

    .fc-day.has-event {
        background-color: #fff5f5 !important;
        border: 2px solid #fed7d7 !important;
    }
    
    .fc-day.has-event:hover {
        background-color: #fed7d7 !important;
    }
    
    .fc-day.has-event .fc-day-number {
        color: #e53e3e !important;
        font-weight: 700;
    }

    .fc-event {
        display: none !important;
    }

    .fc-month-view {
        height: auto !important;
    }

    .fc-view-container {
        height: 100% !important;
        overflow: hidden !important;
    }

    .fc-day-grid-container {
        height: 100% !important;
        overflow: hidden !important;
    }

    .event-slider {
        position: relative;
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        min-height: 400px;
    }
    
    .event-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        gap: 16px;
    }
    
    .event-title {
        font-size: 1.25rem;
        color: #2d3748;
        margin: 0;
        font-weight: 600;
        line-height: 1.4;
        flex: 1;
    }
    
    .event-date {
        color: #718096;
        font-size: 0.875rem;
        white-space: nowrap;
        padding-top: 2px;
    }
    
    .event-about {
        color: #4a5568;
        line-height: 1.6;
        margin-bottom: 24px;
        font-size: 0.95rem;
    }
    
    .event-slide {
        display: none;
    }
    
    .event-navigation {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 24px;
        gap: 16px;
    }
    
    .event-nav-btn {
        background: white;
        color: #4a5568;
        border: 1px solid #e2e8f0;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .event-nav-btn:hover {
        background: #f7fafc;
        border-color: #cbd5e0;
        transform: translateY(-1px);
    }
    
    .event-counter {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.875rem;
        color: #718096;
        font-weight: 500;
    }
    
    .current-event {
        color: #2d3748;
    }
    
    .counter-separator {
        color: #cbd5e0;
    }

    .sl-container {
        position: relative;
        margin-top: 0;
        min-height: 400px;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #f7fafc;
        border-radius: 8px;
        padding: 20px;
    }
    
    .sl-image-slide {
        display: none;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
    }
    
    .image-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        max-width: 100%;
        max-height: 600px;
        position: relative;
    }
    
    .sl-image {
        max-width: 100%;
        max-height: 600px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        object-fit: contain;
        background: white;
    }
    
    .sl-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: white;
        color: #4a5568;
        border: 1px solid #e2e8f0;
        padding: 12px;
        cursor: pointer;
        border-radius: 8px;
        z-index: 5;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .sl-btn:hover {
        background: #f7fafc;
        border-color: #cbd5e0;
        transform: translateY(-50%) scale(1.05);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .sl-prev {
        left: 20px;
    }
    
    .sl-next {
        right: 20px;
    }
    
    .sl-counter {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        backdrop-filter: blur(4px);
    }

    .image-loading, .no-images, .error-message, .no-events {
        text-align: center;
        padding: 60px 20px;
        color: #a0aec0;
        font-size: 0.95rem;
    }
    
    .placeholder-image {
        background: #f7fafc;
        border: 1px dashed #e2e8f0;
        border-radius: 8px;
        padding: 40px 20px;
        text-align: center;
        color: #a0aec0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    
    .placeholder-icon {
        font-size: 32px;
        margin-bottom: 8px;
        opacity: 0.5;
    }
    
    .placeholder-image p {
        margin: 0;
        font-size: 0.875rem;
    }

    .suggestion-item {
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f7fafc;
        transition: background-color 0.2s ease;
        font-size: 0.9rem;
    }
    
    .suggestion-item:hover {
        background-color: #f7fafc;
    }
    
    .suggestion-item:last-child {
        border-bottom: none;
    }
    
    .suggestion-title {
        font-weight: 500;
        color: #2d3748;
    }
    
    .no-results, .error {
        padding: 12px 16px;
        color: #a0aec0;
        text-align: center;
        font-size: 0.9rem;
    }

    .face-canvas {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        border-radius: 8px;
    }
    
    .names-container {
        pointer-events: none !important;
    }
    
    .name-label {
        font-weight: 600;
        transition: none !important;
        transform: none !important;
        pointer-events: auto !important;
    }
    
    .name-label:hover {
        background: rgba(255,255,255,0.95) !important;
        transform: none !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        border: 2px solid #ff4444 !important;
        color: #ff4444 !important;
    }

    @media (max-width: 768px) {
        #calendar-container {
            position: relative;
            top: auto;
            left: auto;
            width: 100%;
            height: 50vh;
            margin-bottom: 20px;
        }
        
        .fc-day {
            min-height: 60px !important;
        }
        
        .sl-image {
            max-height: 400px;
        }
        
        .sl-btn {
            width: 40px;
            height: 40px;
        }
        
        .sl-prev {
            left: 10px;
        }
        
        .sl-next {
            right: 10px;
        }
        
        .event-header {
            flex-direction: column;
            gap: 8px;
        }
        
        .event-date {
            align-self: flex-start;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);