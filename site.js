/* 클못 clemot — content/ 폴더의 자료를 읽어 화면을 그린다.
 *
 * 이 파일은 손대지 않아도 된다. 바꿀 내용은 전부 content/ 안에 있다:
 *   content/사례목록.csv    사례 추가·수정
 *   content/메인배치.csv    메인 12자리에 어느 사진을 쓸지
 *   content/문의.csv        연락처
 *   content/소개.csv        소개 페이지 글 (자리: 글1 ~ 글8)
 *   content/소개/           소개 페이지 사진 (사진1.jpg ~ 사진4.jpg)
 *   content/사진/<사례이름>/ 01.jpg 부터 순서대로
 *
 * 사진은 목록을 따로 적지 않는다. 01.jpg 부터 차례로 찾아보다가
 * 두 번 연속 없으면 거기서 멈춘다. 그래서 파일 이름만 01 부터 순서대로 두면 된다.
 */

var DATA = (function () {
  'use strict';

  // ── 자잘한 도구 ──────────────────────────────────────────────
  // 한글 폴더·파일 이름이 주소에 들어가므로 칸마다 따로 인코딩한다.
  function url(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  /* CSV 읽기. 엑셀이 만든 파일을 그대로 받는다 —
     맨 앞의 BOM, 따옴표로 감싼 칸, 칸 안의 쉼표·줄바꿈까지 처리한다. */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var rows = [], row = [], cell = '', q = false, i;
    for (i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1)
      .filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); })
      .map(function (r) {
        var o = {};
        head.forEach(function (h, k) { o[h] = (r[k] || '').trim(); });
        return o;
      });
  }

  /* 엑셀에서 'CSV UTF-8' 이 아닌 그냥 'CSV' 로 저장하면 한글이 깨져서 들어온다.
     그러면 칸 이름(사례이름·자리·항목)을 못 찾아 화면이 텅 비는데, 원인을 알 길이 없다.
     그래서 첫 줄에 기대한 칸 이름이 있는지 보고, 없으면 바로 짚어 준다. */
  function loadCSV(name, mustHave) {
    return fetch(url('content/' + name) + '?v=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('content/' + name + ' 파일을 찾을 수 없습니다');
        return r.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        if (rows.length && mustHave && !(mustHave in rows[0])) {
          throw new Error(
            name + ' 의 글자가 깨져 있습니다.\n\n' +
            '엑셀에서 저장할 때 형식을 "CSV UTF-8 (쉼표로 분리)" 로 골라 주세요. ' +
            '그냥 "CSV" 로 저장하면 한글이 깨집니다.');
        }
        return rows;
      });
  }

  // 사진 한 장이 실제로 있는지 본다
  function exists(path) {
    return new Promise(function (done) {
      var im = new Image();
      im.onload = function () { done(true); };
      im.onerror = function () { done(false); };
      im.src = url(path);
    });
  }

  /* <사례이름> 폴더의 사진을 01 부터 세어 본다.
     두 번 연속 없으면 멈춘다 — 중간에 한 장이 빠져도 뒤를 계속 읽는다. */
  function photosOf(caseName, cap) {
    var out = [], miss = 0;
    cap = cap || 60;
    function step(n) {
      if (n > cap || miss >= 2) return Promise.resolve(out);
      var f = (n < 10 ? '0' : '') + n + '.jpg';
      return exists('content/사진/' + caseName + '/' + f).then(function (ok) {
        if (ok) { out.push(f); miss = 0; } else miss++;
        return step(n + 1);
      });
    }
    return step(1);
  }

  // ── 자료 모으기 ──────────────────────────────────────────────
  var cache = null;
  function all() {
    if (cache) return cache;
    cache = Promise.all([
      loadCSV('사례목록.csv', '사례이름'),
      loadCSV('메인배치.csv', '자리'),
      loadCSV('문의.csv', '항목')
    ]).then(function (r) {
      var cases = r[0].map(function (c) {
        return {
          name: c['사례이름'], type: c['유형'],
          size: c['평형'], lead: c['대표사진'] || '01.jpg'
        };
      }).filter(function (c) { return c.name; });

      return Promise.all(cases.map(function (c) {
        return photosOf(c.name).then(function (ps) { c.photos = ps; return c; });
      })).then(function () {
        return {
          cases: cases,
          main: r[1].map(function (m) {
            return {
              slot: parseInt(m['자리'], 10),
              caseName: m['사례이름'],
              photo: m['사진']
            };
          }).filter(function (m) { return m.slot >= 1 && m.slot <= 12; })
            .sort(function (a, b) { return a.slot - b.slot; }),
          contact: r[2].map(function (x) {
            return {
              label: x['항목'], value: x['내용'],
              link: x['링크'], linkText: x['링크글자']
            };
          }).filter(function (x) { return x.label; })
        };
      });
    });
    return cache;
  }

  function find(data, name) {
    return data.cases.filter(function (c) { return c.name === name; })[0];
  }

  /* 파일을 더블클릭해서 열면 브라우저가 content 폴더 읽기를 막는다.
     그때 나오는 "Failed to fetch" 만으로는 원인을 알 수 없어서, 따로 짚어 준다. */
  function isLocalFile() { return location.protocol === 'file:'; }

  function why(err) {
    if (isLocalFile()) {
      return '<b>파일을 직접 열면 사진과 글이 나오지 않습니다.</b><br><br>' +
        '브라우저가 안전을 이유로 content 폴더 읽기를 막기 때문입니다. 잘못하신 게 아닙니다.<br><br>' +
        '<b>인터넷 주소로 열어 주세요.</b><br>' +
        'Cloudflare에 올린 뒤 그 주소 뒤에 페이지 이름을 붙이면 됩니다.<br>' +
        '<span style="color:#8a857e">예) clemot.pages.dev/점검.html</span>';
    }
    return '<b>자료를 불러오지 못했습니다.</b><br>' +
      String(err && err.message || err).replace(/\n/g, '<br>') +
      '<br><br>content 폴더가 사이트와 같이 올라갔는지 확인해 주세요.';
  }

  // 무언가 잘못됐을 때 빈 화면 대신 한국어로 알려준다
  function fail(err) {
    var box = document.createElement('div');
    box.style.cssText = 'padding:120px 24px;font-size:17px;line-height:1.8;max-width:640px;margin:0 auto';
    box.innerHTML = why(err) +
      (isLocalFile() ? '' :
        '<br><br><a style="text-decoration:underline" href="점검.html">점검 페이지 열기</a>');
    document.body.appendChild(box);
  }

  // 사례·메인·문의 말고 다른 표 하나만 읽고 싶을 때 (소개 글 등)
  function text(name) { return loadCSV(name); }

  /* 메인 캡션용 평형 표기 — '33평' → '33PY' (2026-09-26 소장님).
     엑셀에는 평소처럼 '33평' 으로 적으면 된다. 숫자가 없으면 적힌 그대로 둔다. */
  function py(size) {
    var m = String(size || '').match(/\d+(\.\d+)?/);
    return m ? m[0] + 'PY' : String(size || '');
  }

  /* 소개 페이지 — content/소개.csv 를 자리(글1, 글2 …)별로 묶는다.
     같은 자리를 여러 줄 적으면 한 줄이 한 단락이 된다. */
  function about() {
    return loadCSV('소개.csv', '자리').then(function (rows) {
      var by = {};
      rows.forEach(function (r) {
        var k = (r['자리'] || '').replace(/\s/g, '');
        if (!k || !r['문단']) return;
        (by[k] = by[k] || []).push(r['문단']);
      });
      return by;
    });
  }

  return {
    all: all, find: find, url: url, photosOf: photosOf, fail: fail, why: why, text: text,
    exists: exists, py: py, about: about,
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
      });
    }
  };
})();

/* 모바일 메뉴 — 참고 사이트(AKV) mobileMenu.js 를 그대로 옮겼다 (2026-09-26 소장님).
   짝대기 두 개를 누르면 → 한 개로 접히고, 클못·clemot 이 오른쪽으로 빠지며 사라진 뒤
   그 자리에 시공사례·문의가 왼쪽에서 들어온다. 다시 누르면 거꾸로.
   AKV 값: 0.5초 동안 20px 움직이고, 들어오는 쪽은 1초 늦게 출발한다. */
(function () {
  var btn = document.getElementById('menu-btn');
  var nav = document.querySelector('.head .nav');
  var logos = [].slice.call(document.querySelectorAll('.head .b1, .head .b2'));
  if (!btn || !nav) return;

  var DUR = 500, DELAY = 1000, X = 20;
  var IN = 'cubic-bezier(.55,.085,.68,.53)', OUT = 'cubic-bezier(.25,.46,.45,.94)';
  var open = false;

  function mobile() { return getComputedStyle(btn).display !== 'none'; }

  function out(el) {
    el.getAnimations().forEach(function (a) { a.cancel(); });
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + X + 'px)' }],
      { duration: DUR, easing: IN, fill: 'forwards' })
      .onfinish = function () { el.style.visibility = 'hidden'; el.style.pointerEvents = 'none'; };
  }
  function into(el) {
    el.getAnimations().forEach(function (a) { a.cancel(); });
    el.style.visibility = 'visible'; el.style.pointerEvents = 'auto';
    el.animate([{ opacity: 0, transform: 'translateX(' + -X + 'px)' }, { opacity: 1, transform: 'none' }],
      { duration: DUR, delay: DELAY, easing: OUT, fill: 'both' });
  }

  function set(on) {
    open = on;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { logos.forEach(out); into(nav); }
    else { out(nav); logos.forEach(into); }
  }

  // 처음 상태로 — PC 로 넓어졌거나, 뒤로가기로 돌아왔을 때
  function reset() {
    open = false;
    btn.classList.remove('on');
    btn.setAttribute('aria-expanded', 'false');
    [nav].concat(logos).forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
      el.style.visibility = ''; el.style.pointerEvents = '';
    });
  }

  btn.addEventListener('click', function () { if (mobile()) set(!open); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) set(false); });
  addEventListener('resize', function () { if (!mobile() && open) reset(); });
  addEventListener('pageshow', function (e) { if (e.persisted) reset(); });
})();
