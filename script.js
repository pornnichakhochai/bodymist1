/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + กรองตาม mood   (#filter-bar, #product-list)
   - order.html   : เติมฟอร์มจาก URL + ส่งคำสั่งซื้อ (#orderForm, #customerName,
                    #contact, #items, #total, #note)
   - admin.html   : แสดงรายการสั่งซื้อจาก Google Sheet (#ordersTable tbody)
   แต่ละส่วนจะทำงานเมื่อเจอ element ของหน้านั้นเท่านั้น
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     ค่าตั้งต้น
     ------------------------------------------------------------------------ */
  var APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwr49bowqkZbgknAIQhvNncd3cMLLIGZZWDI9ObS9nq9tMit3WxH9KpIeC47W3as3pO/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4juWtMWv3Xb7yxC3OymAEiBf-SOQNPN8SL_jiWrUmw77-15-HTeWDzVNrUCWlw7B_-iHFdtQRKjJp/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = {
    spray: "น้ำหอมฉีดตัว",
    rollon: "โรลออน"
  };

  /* ------------------------------------------------------------------------
     Helper
     ------------------------------------------------------------------------ */
  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  function isValidMood(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return true;
    }
    return false;
  }

  function formatNumber(value) {
    var n = Number(String(value).replace(/,/g, ""));
    if (value === "" || value === null || isNaN(n)) return String(value);
    return n.toLocaleString("th-TH");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ========================================================================
     1) หน้า product.html
     ======================================================================== */
  var allProducts = [];

  function buildOrderUrl(product) {
    // ชื่อสินค้า + ไซส์ เช่น "น้ำหอมฉีดตัว Fresh เล็ก 30ml"
    var item = product.size ? product.name + " " + product.size : product.name;
    return (
      "order.html?item=" + encodeURIComponent(item) +
      "&price=" + encodeURIComponent(product.price)
    );
  }

  function createProductCard(product) {
    var card = el("article", "product-card");
    card.setAttribute("data-mood", product.mood);

    // รูป
    var media = el("div", "product-card__media");
    var img = document.createElement("img");
    img.src = product.image;
    img.alt = product.name;
    img.loading = "lazy";
    media.appendChild(img);

    // เนื้อหา
    var body = el("div", "product-card__body");

    var tag = el("span", "mood-tag", moodLabel(product.mood));
    var title = el("h3", "product-card__title", product.name);
    var meta = el(
      "div",
      "product-card__meta",
      product.size ? product.size : TYPE_LABELS[product.type] || ""
    );

    // ราคา + ปุ่มสั่งซื้อ
    var footer = el("div", "product-card__footer");
    var price = el("span", "price", formatNumber(product.price));
    price.appendChild(el("small", null, "บาท"));

    var btn = el("a", "btn btn--small", "สั่งซื้อ");
    btn.href = buildOrderUrl(product);

    footer.appendChild(price);
    footer.appendChild(btn);

    body.appendChild(tag);
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function renderProducts(mood) {
    var list = document.getElementById("product-list");
    list.innerHTML = "";

    var filtered = allProducts.filter(function (p) {
      return mood === "all" || p.mood === mood;
    });

    if (filtered.length === 0) {
      list.appendChild(el("p", "text-mute", "ไม่พบสินค้าในหมวดนี้"));
      return;
    }

    filtered.forEach(function (p) {
      list.appendChild(createProductCard(p));
    });
  }

  function setActiveFilter(mood) {
    var buttons = document.querySelectorAll("#filter-bar .filter-btn");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-filter") === mood;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function applyFilter(mood) {
    setActiveFilter(mood);
    renderProducts(mood);
  }

  function buildFilterBar() {
    var bar = document.getElementById("filter-bar");
    bar.innerHTML = "";

    MOODS.forEach(function (m) {
      var btn = el("button", "filter-btn");
      btn.type = "button";
      btn.setAttribute("data-filter", m.key);

      if (m.key !== "all") {
        btn.setAttribute("data-mood", m.key);
        btn.appendChild(el("span", "mood-dot"));
      }
      btn.appendChild(document.createTextNode(m.label));

      btn.addEventListener("click", function () {
        applyFilter(m.key);
      });
      bar.appendChild(btn);
    });
  }

  function initProductPage() {
    var list = document.getElementById("product-list");
    buildFilterBar();
    list.appendChild(el("p", "text-mute", "กำลังโหลดสินค้า..."));

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        allProducts = data;

        // อ่าน ?mood=xxx แล้วกรองอัตโนมัติ (ค่าที่ไม่รู้จัก = ทั้งหมด)
        var params = new URLSearchParams(window.location.search);
        var mood = (params.get("mood") || "all").toLowerCase();
        applyFilter(isValidMood(mood) ? mood : "all");
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = "";
        list.appendChild(
          el("p", "text-mute", "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
        );
      });
  }

  /* ========================================================================
     2) หน้า order.html
     ======================================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // เติมค่าจาก URL parameter ทันทีที่โหลดหน้า (ทั้ง items และ total)
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    if (item !== null && itemsInput) itemsInput.value = item;
    if (price !== null && totalInput) totalInput.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value,
        total: document.getElementById("total").value,
        note: document.getElementById("note").value.trim()
      };

      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = "thankyou.html"; })
        .catch(error => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ========================================================================
     3) หน้า admin.html
     ======================================================================== */

  // parse CSV เอง: รองรับ "..." , "" (escape), เครื่องหมายคอมมาและขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่าง
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function setOrdersMessage(tbody, message) {
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = el("td", "text-center text-mute", message);
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    setOrdersMessage(tbody, "กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (csv) {
        var rows = parseCSV(csv);
        rows.shift(); // ตัดแถวหัวตาราง

        if (rows.length === 0) {
          setOrdersMessage(tbody, "ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // ชีตเพิ่มรายการใหม่ต่อท้ายเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.innerHTML = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");

          // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
          for (var i = 0; i < 6; i++) {
            var value = r[i] !== undefined ? r[i] : "";
            if (i === 4) value = formatNumber(value);
            var td = el("td", i === 4 ? "text-right" : null, value);
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        setOrdersMessage(tbody, "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     เริ่มทำงาน: ตรวจว่าหน้านี้มี element ของส่วนไหน แล้วเรียกเฉพาะส่วนนั้น
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("product-list") && document.getElementById("filter-bar")) {
      initProductPage();
    }
    if (document.getElementById("orderForm")) {
      initOrderPage();
    }
    if (document.querySelector("#ordersTable tbody")) {
      initAdminPage();
    }
  });
})();
