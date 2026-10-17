/* ==========================================================
   Школьный музей ГБОУ СОШ №3 г. Похвистнево
   Vanilla JS — общий скрипт для всех страниц
   ========================================================== */
(() => {
  'use strict';

  const root = document.body.dataset.root || '.';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------
     Тема (светлая / тёмная)
     ------------------------------------------------------ */
  const THEME_KEY = 'museum-theme';
  const themeBtn = $('#themeToggle');

  const getStoredTheme = () => {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  };
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e121b' : '#0b2a5b');
  };

  applyTheme(getStoredTheme() || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    });
  }

  /* ------------------------------------------------------
     Шапка: прозрачная -> белая при прокрутке
     ------------------------------------------------------ */
  const header = $('#header');
  const toTop = $('#toTop');
  const heroBg = $('#heroBg');
  const heroSection = $('.hero');
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    if (header && !header.classList.contains('solid')) {
      header.classList.toggle('scrolled', y > 40);
    }
    if (toTop) toTop.classList.toggle('show', y > 700);

    // Параллакс первого экрана
    if (heroBg && heroSection && !reduceMotion && y < heroSection.offsetHeight) {
      heroBg.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  }

  /* ------------------------------------------------------
     Мобильное меню
     ------------------------------------------------------ */
  const burger = $('#burger');
  const nav = $('#nav');

  const setMenu = (open) => {
    if (!burger || !nav) return;
    nav.classList.toggle('open', open);
    header.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  if (burger && nav) {
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 980) setMenu(false); });
  }

  /* ------------------------------------------------------
     Intersection Observer: появление элементов
     ------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ------------------------------------------------------
     Счётчики
     ------------------------------------------------------ */
  const counters = $$('[data-count]');
  const animateCounter = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('ru-RU') + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (counters.length) {
    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { animateCounter(entry.target); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach((c) => cio.observe(c));
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ------------------------------------------------------
     Слайдер лучших экспонатов
     ------------------------------------------------------ */
  const slider = $('#slider');
  if (slider) {
    const prev = $('#sliderPrev');
    const next = $('#sliderNext');
    const stepSize = () => {
      const slide = $('.slide', slider);
      return slide ? slide.getBoundingClientRect().width + 22 : 300;
    };
    const scrollBySlide = (dir) => slider.scrollBy({ left: dir * stepSize(), behavior: reduceMotion ? 'auto' : 'smooth' });

    prev && prev.addEventListener('click', () => scrollBySlide(-1));
    next && next.addEventListener('click', () => scrollBySlide(1));
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollBySlide(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollBySlide(-1); }
    });

    // Перетаскивание мышью
    let down = false, startX = 0, startLeft = 0;
    slider.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; startX = e.clientX; startLeft = slider.scrollLeft;
      slider.style.scrollSnapType = 'none';
      slider.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      slider.scrollLeft = startLeft - (e.clientX - startX);
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      slider.style.scrollSnapType = '';
      slider.style.cursor = '';
    });
  }

  /* ------------------------------------------------------
     Временная шкала музея (демо-данные — заменить на реальные)
     ------------------------------------------------------ */
  const timelineData = [
    { year: '2010', title: 'Идея создания музея', text: 'Появилась идея собрать в школе материалы о земляках-участниках войны и сохранить их для будущих поколений. (Текст-заглушка — будет заменён.)' },
    { year: '2012', title: 'Первые экспонаты', text: 'Начался сбор предметов, документов и фотографий. Учащиеся и жители города передали первые подлинные вещи. (Текст-заглушка.)' },
    { year: '2015', title: 'Открытие первой экспозиции', text: 'Состоялось торжественное открытие музея и первой экспозиции, посвящённой Великой Отечественной войне. (Текст-заглушка.)' },
    { year: '2019', title: 'Новые разделы', text: 'Коллекция пополнилась материалами о пограничных войсках, военной форме и наградах. (Текст-заглушка.)' },
    { year: '2023', title: 'Современная армия России', text: 'Открыт раздел о современной армии: экспонаты, привезённые и переданные участниками современных событий. (Текст-заглушка.)' },
    { year: '2026', title: 'Виртуальный музей', text: 'Запущен сайт музея с виртуальной экскурсией, электронным каталогом экспонатов и фотогалереей. (Текст-заглушка.)' }
  ];

  const rail = $('#timelineRail');
  if (rail) {
    const tlYear = $('#tlYear');
    const tlTitle = $('#tlTitle');
    const tlText = $('#tlText');
    const panel = $('#timelinePanel');

    const select = (index) => {
      const item = timelineData[index];
      $$('.tl-dot', rail).forEach((b, i) => {
        b.classList.toggle('active', i === index);
        b.setAttribute('aria-selected', String(i === index));
      });
      // перезапуск анимации появления
      [tlYear, tlTitle, tlText].forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      tlYear.textContent = item.year;
      tlTitle.textContent = item.title;
      tlText.textContent = item.text;
    };

    timelineData.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tl-dot';
      btn.setAttribute('role', 'tab');
      btn.innerHTML = `<span>${item.year}</span>`;
      btn.addEventListener('click', () => select(i));
      rail.appendChild(btn);
    });
    select(timelineData.length - 1);

    if (panel) {
      panel.addEventListener('keydown', () => {});
    }
  }

  /* ------------------------------------------------------
     Видеоплеер-заглушка
     ------------------------------------------------------ */
  const playBtn = $('#playBtn');
  const playNote = $('#playNote');
  if (playBtn && playNote) {
    playBtn.addEventListener('click', () => {
      playNote.hidden = !playNote.hidden;
    });
  }

  /* ------------------------------------------------------
     Lightbox
     ------------------------------------------------------ */
  const initLightbox = () => {
    const items = $$('[data-lightbox]');
    if (!items.length) return;

    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Просмотр изображения');
    lb.innerHTML = `
      <button class="lightbox__btn lightbox__close" type="button" aria-label="Закрыть">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button class="lightbox__btn lightbox__prev" type="button" aria-label="Предыдущее">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="lightbox__btn lightbox__next" type="button" aria-label="Следующее">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="">
        <figcaption class="lightbox__cap"></figcaption>
      </figure>`;
    document.body.appendChild(lb);

    const img = $('.lightbox__img', lb);
    const cap = $('.lightbox__cap', lb);
    let current = 0;
    let lastFocus = null;

    const show = (i) => {
      current = (i + items.length) % items.length;
      const el = items[current];
      img.src = el.getAttribute('href');
      img.alt = el.dataset.title || '';
      cap.innerHTML = '';
      cap.append(el.dataset.title || '');
      const small = document.createElement('small');
      small.textContent = `${current + 1} / ${items.length}`;
      cap.appendChild(small);
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', lb).focus();
    };
    const close = () => {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    items.forEach((el, i) => el.addEventListener('click', (e) => { e.preventDefault(); open(i); }));
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__prev', lb).addEventListener('click', () => show(current - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(current + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox__figure')) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    // Свайп на телефоне
    let tx = 0;
    lb.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
  };

  /* ------------------------------------------------------
     Страница «Фотогалерея»: генерация masonry
     (Для реальных фото замените src на images/photo-xx.jpg)
     ------------------------------------------------------ */
  const galleryGrid = $('#galleryGrid');
  if (galleryGrid) {
    const galleryData = [
      { n: 1, w: 800, h: 1000, t: 'Из коллекции музея' },
      { n: 2, w: 800, h: 600, t: 'Экспонаты' },
      { n: 3, w: 800, h: 900, t: 'Экспозиция СВО' },
      { n: 4, w: 800, h: 700, t: 'Военная форма' },
      { n: 5, w: 800, h: 1000, t: 'Награды и документы' },
      { n: 6, w: 800, h: 650, t: 'Экспозиция' },
      { n: 7, w: 800, h: 1000, t: 'Зал музея' },
      { n: 8, w: 800, h: 600, t: 'Экспозиция' },
      { n: 9, w: 800, h: 900, t: 'Витрина' },
      { n: 10, w: 800, h: 700, t: 'Урок мужества' },
      { n: 11, w: 800, h: 1000, t: 'Встреча с ветеранами' },
      { n: 12, w: 800, h: 650, t: 'Экскурсия' }
    ];
    galleryGrid.innerHTML = galleryData.map((g, i) => `
      <a class="masonry__item" href="${root}/images/gal-${g.n}.svg" data-lightbox data-title="${g.t}" data-reveal="zoom" style="--d:${(i % 3) * 0.08}s">
        <img src="${root}/images/gal-${g.n}.svg" alt="${g.t}" width="${g.w}" height="${g.h}" loading="lazy">
      </a>`).join('');
    $$('[data-reveal]', galleryGrid).forEach((el) => el.classList.add('in'));
  }
  initLightbox();

  /* ------------------------------------------------------
     Реальные фото: <img src="заглушка" data-photo="путь/к/фото.jpg">
     Если файл фото существует — он подставится вместо заглушки.
     ------------------------------------------------------ */
  const upgradePhoto = (img, photo) => {
    if (!photo) return;
    const probe = new Image();
    probe.onload = () => { img.src = probe.src; };
    probe.src = photo;
  };
  const upgradePhotos = (ctx = document) => $$('img[data-photo]', ctx).forEach((img) => upgradePhoto(img, img.dataset.photo));
  upgradePhotos();

  /* ------------------------------------------------------
     КОНТЕНТ ИЗ DECAP CMS
     Админка сохраняет Markdown-файлы в content/…, а скрипт
     scripts/build-content.js (запускается при каждом деплое)
     собирает их в три JSON-файла. Здесь мы их читаем.
     ------------------------------------------------------ */
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Путь из админки («/images/uploads/a.jpg») -> рабочий путь с учётом папки страницы */
  const resolvePath = (p) => (/^(https?:)?\/\//.test(p) ? p : `${root}/${String(p).replace(/^\/+/, '')}`);

  /* Цвет из админки пускаем в style только если это настоящий hex-цвет */
  const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '');
  const safeName = (s) => (/^[\w-]+$/.test(s || '') ? s : 'ww2');

  /* Очистка HTML после marked.js: описания пишет администратор, но лишнее всё равно вырезаем */
  const sanitizeHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    $$('script,style,iframe,object,embed,link,meta,form', doc.body).forEach((n) => n.remove());
    $$('*', doc.body).forEach((el) => {
      [...el.attributes].forEach((a) => {
        const name = a.name.toLowerCase();
        if (name.startsWith('on') || ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
      });
      if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      if (el.tagName === 'IMG') { el.loading = 'lazy'; el.setAttribute('src', resolvePath(el.getAttribute('src') || '')); }
    });
    return doc.body.innerHTML;
  };

  /* Markdown -> HTML (marked.js). Если библиотека не загрузилась — простой запасной вариант */
  const mdToHtml = (md) => {
    const src = String(md || '');
    try {
      if (window.marked) return sanitizeHtml(window.marked.parse(src));
    } catch (err) { /* упадём на запасной вариант */ }
    return src.split(/\n{2,}/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  };
  const htmlToText = (html) => (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();

  /* Ссылка на видео -> адрес для iframe (YouTube / Rutube) */
  const videoEmbed = (url) => {
    let u;
    try { u = new URL(url); } catch (err) { return null; }
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    if (host === 'youtube.com') id = u.searchParams.get('v') || (/^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname) || [])[1];
    if (id && /^[\w-]{6,20}$/.test(id)) return { src: `https://www.youtube-nocookie.com/embed/${id}` };
    if (host === 'rutube.ru') {
      const m = /\/(?:video\/(?:private\/)?|play\/embed\/)([0-9a-f]{32})/i.exec(u.pathname);
      if (m) {
        const key = u.searchParams.get('p'); // у «приватных» видео Rutube есть ключ ?p=…
        return { src: `https://rutube.ru/play/embed/${m[1]}${key ? `?p=${encodeURIComponent(key)}` : ''}` };
      }
    }
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'rutube.ru') return { link: url };
    return null;
  };

  /* Склонение слова «экспонат»: nom — «21 экспонат», gen — «из 21 экспоната» */
  const exhibitWord = (n, form) => {
    const m10 = n % 10, m100 = n % 100;
    if (form === 'gen') return m10 === 1 && m100 !== 11 ? 'экспоната' : 'экспонатов';
    if (m10 === 1 && m100 !== 11) return 'экспонат';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'экспоната';
    return 'экспонатов';
  };

  /* Загружаем три JSON-файла один раз и готовим удобные справочники */
  let contentPromise = null;
  const loadContent = () => {
    if (contentPromise) return contentPromise;
    const get = (name) => fetch(`${root}/content/${name}.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`${name}.json: ${r.status}`); return r.json(); });

    contentPromise = Promise.all([get('categories'), get('tags'), get('exhibits')]).then(([categories, tags, exhibits]) => {
      const catMap = {};
      categories.forEach((c) => { catMap[c.slug] = c; });
      const tagMap = {};
      tags.forEach((t) => { tagMap[t.slug] = t; });

      const catLabel = (slug) => (catMap[slug] ? (catMap[slug].short_title || catMap[slug].title) : slug);
      const tagLabel = (slug) => (tagMap[slug] ? tagMap[slug].title : slug);
      const placeholderOf = (slug) => safeName(catMap[slug] && catMap[slug].placeholder);
      const accentOf = (slug) => safeColor(catMap[slug] && catMap[slug].color);
      /* Главное фото: загруженное в админке, иначе старое соглашение images/exhibits/<номер>.jpg */
      const photoOf = (e) => {
        const first = e.image || (e.gallery && e.gallery[0]);
        return first ? resolvePath(first) : `${root}/images/exhibits/${e.number}.jpg`;
      };

      exhibits.forEach((e) => {
        e.html = mdToHtml(e.body);
        e.text = htmlToText(e.html);
        e.tagTitles = e.tags.map(tagLabel);
      });
      return { categories, tags, exhibits, catMap, tagMap, catLabel, tagLabel, placeholderOf, accentOf, photoOf };
    });
    return contentPromise;
  };

  /* Счётчики «N экспонатов» в тексте страниц: <span data-exhibit-count="nom|gen"> */
  const countEls = $$('[data-exhibit-count]');
  if (countEls.length) {
    loadContent().then(({ exhibits }) => {
      countEls.forEach((el) => {
        el.textContent = `${exhibits.length} ${exhibitWord(exhibits.length, el.dataset.exhibitCount === 'gen' ? 'gen' : 'nom')}`;
      });
    }).catch(() => { /* остаётся текст из HTML */ });
  }

  /* ------------------------------------------------------
     Главная: блок «Из коллекции» — до 4 экспонатов с featured: true
     (если загрузка не удалась — остаются карточки из HTML)
     ------------------------------------------------------ */
  const featuredBox = $('#featuredCards');
  if (featuredBox) {
    loadContent().then((data) => {
      const list = data.exhibits.filter((e) => e.featured).slice(0, 4);
      if (!list.length) return;
      featuredBox.innerHTML = list.map((e, i) => {
        const accent = data.accentOf(e.category);
        return `
          <div data-reveal="up" class="in" style="--d:${(i * 0.08).toFixed(2)}s">
            <article class="card" data-cat="${escapeHtml(e.category)}"${accent ? ` style="--accent:${accent}"` : ''}>
              <div class="card__media">
                <span class="card__num">№ ${escapeHtml(e.number)}</span>
                <img src="${root}/images/${data.placeholderOf(e.category)}.svg" data-photo="${escapeHtml(data.photoOf(e))}" alt="${escapeHtml(e.title)}" width="800" height="600" loading="lazy">
              </div>
              <div class="card__body">
                <span class="card__cat">${escapeHtml(data.catLabel(e.category))}</span>
                <h3 class="card__title">${escapeHtml(e.title)}</h3>
                <p class="card__text">${escapeHtml(e.text)}</p>
                <a class="card__more" href="${root}/pages/exhibits.html#e${encodeURIComponent(e.number)}">Подробнее</a>
              </div>
            </article>
          </div>`;
      }).join('');
      upgradePhotos(featuredBox);
    }).catch(() => { /* статичные карточки из HTML остаются как запасной вариант */ });
  }

  /* ------------------------------------------------------
     Страница «Экспонаты»: каталог, поиск, категории, теги, окно
     Всё берётся из content/*.json (то есть из админки).
     ------------------------------------------------------ */
  const cardsBox = $('#cards');
  if (cardsBox) {
    const emptyBox = $('#empty');
    const showLoadError = () => {
      $('#resultsInfo').textContent = '';
      emptyBox.innerHTML = '<strong>Не удалось загрузить каталог</strong>Обновите страницу. Если вы открыли файл прямо с компьютера, запустите сайт через локальный сервер или откройте его в интернете.';
      emptyBox.classList.add('show');
    };
    loadContent().then(initCatalog).catch(showLoadError);
  }

  function initCatalog(data) {
    const { categories, exhibits, catMap, tagMap, catLabel, tagLabel, placeholderOf, accentOf, photoOf } = data;

    const chipsBox = $('#chips');
    const tagBox = $('#tagChips');
    const input = $('#searchInput');
    const clearBtn = $('#searchClear');
    const info = $('#resultsInfo');
    const empty = $('#empty');

    /* Фильтр по категории: родитель показывает и экспонаты своих подразделов */
    const inCat = (e, cat) => cat === 'all' || e.category === cat || (catMap[e.category] && catMap[e.category].parent === cat);

    /* Теги: сначала самые частые, затем по алфавиту */
    const tagCount = {};
    data.tags.forEach((t) => { tagCount[t.slug] = 0; });
    exhibits.forEach((e) => e.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const allTags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a] || tagLabel(a).localeCompare(tagLabel(b), 'ru'));

    let activeCat = 'all';
    let activeTag = '';
    const params = new URLSearchParams(window.location.search);
    if (params.get('cat') && catMap[params.get('cat')]) activeCat = params.get('cat');
    if (params.get('tag') && tagCount[params.get('tag')] !== undefined) activeTag = params.get('tag');

    /* Карточки */
    cardsBox.innerHTML = exhibits.map((e, i) => {
      const search = (e.title + ' ' + e.text + ' ' + e.tagTitles.join(' ') + ' ' + catLabel(e.category) + ' №' + e.number).toLowerCase();
      const accent = accentOf(e.category);
      return `
      <article class="card" data-n="${escapeHtml(e.number)}" data-cat="${escapeHtml(e.category)}" data-search="${escapeHtml(search)}" style="${accent ? `--accent:${accent};` : ''}animation-delay:${(i % 8) * 0.05}s">
        <div class="card__media">
          <span class="card__num">№ ${escapeHtml(e.number)}</span>
          <img src="${root}/images/${placeholderOf(e.category)}.svg" data-photo="${escapeHtml(photoOf(e))}" alt="${escapeHtml(e.title)}" width="800" height="600" loading="lazy">
        </div>
        <div class="card__body">
          <span class="card__cat">${escapeHtml(catLabel(e.category))}</span>
          <h3 class="card__title">${escapeHtml(e.title)}</h3>
          <p class="card__text">${escapeHtml(e.text)}</p>
          <div class="card__tags">${e.tagTitles.slice(0, 3).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
          <button class="card__more" type="button" aria-label="Открыть описание: ${escapeHtml(e.title)}">Подробнее</button>
        </div>
      </article>`;
    }).join('');
    upgradePhotos(cardsBox);

    /* Фильтры строятся из категорий и тегов, добавленных в админке */
    chipsBox.innerHTML = [`<button type="button" class="chip" data-cat="all">Все экспонаты</button>`]
      .concat(categories.map((c) => `<button type="button" class="chip" data-cat="${escapeHtml(c.slug)}">${escapeHtml(c.short_title || c.title)}</button>`)).join('');
    tagBox.innerHTML = allTags.map((t) =>
      `<button type="button" class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(tagLabel(t))}</button>`).join('');

    const cards = $$('.card', cardsBox);

    const filter = () => {
      const q = input.value.trim().toLowerCase();
      const numQuery = /^№?\s*\d+$/.test(q) ? q.replace(/\D/g, '') : null;
      let shown = 0;
      cards.forEach((card, i) => {
        const e = exhibits[i];
        const okCat = inCat(e, activeCat);
        const okTag = !activeTag || e.tags.indexOf(activeTag) !== -1;
        const okText = !q || (numQuery !== null ? String(parseInt(e.number, 10)) === String(parseInt(numQuery, 10)) : card.dataset.search.indexOf(q) !== -1);
        const visible = okCat && okTag && okText;
        card.hidden = !visible;
        if (visible) shown++;
      });
      info.textContent = `Найдено: ${shown} ${exhibitWord(shown, 'nom')}`;
      if (shown === 0) {
        const sectionOnly = !q && !activeTag;
        empty.innerHTML = sectionOnly
          ? '<strong>Раздел пополняется</strong>Экспонаты этого раздела скоро появятся в каталоге.'
          : '<strong>Ничего не найдено</strong>Попробуйте изменить запрос или сбросить фильтры.';
      }
      empty.classList.toggle('show', shown === 0);
      clearBtn.classList.toggle('show', q.length > 0);
      $$('.chip', chipsBox).forEach((c) => c.classList.toggle('active', c.dataset.cat === activeCat));
      $$('.chip', tagBox).forEach((c) => c.classList.toggle('active', c.dataset.tag === activeTag));
    };

    input.addEventListener('input', filter);
    clearBtn.addEventListener('click', () => { input.value = ''; input.focus(); filter(); });
    chipsBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeCat = chip.dataset.cat;
      filter();
    });
    tagBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeTag = activeTag === chip.dataset.tag ? '' : chip.dataset.tag;
      filter();
    });
    filter();

    /* ---- Модальное окно с полным описанием ---- */
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalTitle');
    modal.innerHTML = `
      <div class="modal__dialog">
        <button class="modal__close" type="button" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="modal__media"><img alt="" width="800" height="600"></div>
        <div class="modal__body">
          <span class="modal__num"></span>
          <span class="modal__cat"></span>
          <h2 class="modal__title" id="modalTitle"></h2>
          <ul class="tags"></ul>
          <div class="modal__text md"></div>
          <div class="modal__gallery" hidden></div>
          <div class="modal__video" hidden></div>
          <div class="modal__nav">
            <button class="icon-btn icon-btn--round" type="button" data-dir="-1" aria-label="Предыдущий экспонат">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn icon-btn--round" type="button" data-dir="1" aria-label="Следующий экспонат">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <span></span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const mDialog = $('.modal__dialog', modal);
    const mImg = $('.modal__media img', modal);
    const mNum = $('.modal__num', modal);
    const mCat = $('.modal__cat', modal);
    const mTitle = $('.modal__title', modal);
    const mTags = $('.tags', modal);
    const mText = $('.modal__text', modal);
    const mGallery = $('.modal__gallery', modal);
    const mVideo = $('.modal__video', modal);
    const mCount = $('.modal__nav span', modal);
    let currentN = null;
    let lastFocus = null;

    const visibleNums = () => cards.filter((c) => !c.hidden).map((c) => c.dataset.n);
    const clearVideo = () => { mVideo.innerHTML = ''; mVideo.hidden = true; };

    const showExhibit = (n) => {
      const e = exhibits.find((x) => x.number === n);
      if (!e) return;
      currentN = n;
      const accent = accentOf(e.category);
      mDialog.dataset.cat = e.category;
      if (accent) mDialog.style.setProperty('--accent', accent); else mDialog.style.removeProperty('--accent');

      /* Фото: сначала заглушка категории, затем настоящее фото, если оно есть */
      mImg.src = `${root}/images/${placeholderOf(e.category)}.svg`;
      mImg.alt = e.title;
      upgradePhoto(mImg, photoOf(e));

      mNum.textContent = `№ ${e.number}`;
      mCat.textContent = catLabel(e.category);
      mTitle.textContent = e.title;
      mText.innerHTML = e.html;               // уже очищено в sanitizeHtml
      mTags.innerHTML = e.tagTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join('');

      /* Галерея: миниатюры переключают главное фото */
      const photos = [e.image].concat(e.gallery || []).filter(Boolean);
      if (photos.length > 1) {
        mGallery.innerHTML = photos.map((p, i) =>
          `<button type="button" class="modal__thumb" data-src="${escapeHtml(resolvePath(p))}" aria-label="Фото ${i + 1} из ${photos.length}"><img src="${escapeHtml(resolvePath(p))}" alt="" loading="lazy"></button>`).join('');
        mGallery.hidden = false;
      } else {
        mGallery.innerHTML = '';
        mGallery.hidden = true;
      }

      /* Видео: YouTube / Rutube */
      clearVideo();
      const embed = e.video_url ? videoEmbed(e.video_url) : null;
      if (embed && embed.src) {
        const frame = document.createElement('iframe');
        frame.src = embed.src;
        frame.title = `Видео: ${e.title}`;
        frame.loading = 'lazy';
        frame.allow = 'fullscreen; picture-in-picture; encrypted-media';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        mVideo.appendChild(frame);
        mVideo.hidden = false;
      } else if (embed && embed.link) {
        mVideo.innerHTML = `<a class="btn btn--outline" href="${escapeHtml(embed.link)}" target="_blank" rel="noopener noreferrer">Смотреть видео</a>`;
        mVideo.hidden = false;
      }

      const list = visibleNums();
      const pos = list.indexOf(n);
      mCount.textContent = pos === -1 ? '' : `${pos + 1} из ${list.length}`;
      try { history.replaceState(null, '', `#e${n}`); } catch (err) { /* ignore */ }
    };

    mGallery.addEventListener('click', (ev) => {
      const thumb = ev.target.closest('.modal__thumb');
      if (thumb) mImg.src = thumb.dataset.src;
    });

    const openModal = (n) => {
      lastFocus = document.activeElement;
      showExhibit(n);
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      $('.modal__close', modal).focus();
    };
    const closeModal = () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      currentN = null;
      clearVideo();                            // останавливаем воспроизведение
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (err) { /* ignore */ }
      if (lastFocus) lastFocus.focus();
    };
    const step = (dir) => {
      const list = visibleNums();
      if (!list.length) return;
      const pos = list.indexOf(currentN);
      const next = list[(pos === -1 ? 0 : (pos + dir + list.length) % list.length)];
      showExhibit(next);
    };

    cardsBox.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openModal(card.dataset.n);
    });
    $('.modal__close', modal).addEventListener('click', closeModal);
    $$('[data-dir]', modal).forEach((b) => b.addEventListener('click', () => step(parseInt(b.dataset.dir, 10))));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });

    /* Ссылка вида exhibits.html#e3 сразу открывает экспонат №3 */
    const openFromHash = () => {
      const m = /^#e(\d+)$/.exec(window.location.hash);
      if (m && exhibits.some((x) => x.number === m[1])) {
        if (modal.classList.contains('open')) showExhibit(m[1]); else openModal(m[1]);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* ------------------------------------------------------
     Форма на странице контактов (открывает почтовую программу)
     ------------------------------------------------------ */
  const form = $('#contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const msg = form.elements.message.value.trim();
      const subject = encodeURIComponent('Сообщение с сайта школьного музея');
      const body = encodeURIComponent(`Имя: ${name}\nПочта: ${email}\n\n${msg}`);
      window.location.href = `mailto:museum@example.ru?subject=${subject}&body=${body}`;
    });
  }

  /* ------------------------------------------------------
     Год в подвале
     ------------------------------------------------------ */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
