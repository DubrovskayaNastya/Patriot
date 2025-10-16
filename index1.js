function toggleMenu() {
    var menu = document.getElementById("menu");
    var overlay = document.getElementById("overlay");
    
    menu.classList.toggle("show");
    overlay.classList.toggle("show");
  }
  
  document.getElementById("search")?.addEventListener("keyup", function() {
    let filter = this.value.toLowerCase();
    let items = document.querySelectorAll(".list li");
  
    items.forEach(item => {
      if (item.textContent.toLowerCase().includes(filter)) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    });
  });

  

  

  







