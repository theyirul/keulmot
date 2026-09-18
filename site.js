/* 클못 clemot — content/ 폴더의 자료를 읽어 화면을 그린다.
 *
 * 이 파일은 손대지 않아도 된다. 바꿀 내용은 전부 content/ 안에 있다:
 *   content/사례목록.csv    사례 추가·수정
 *   content/메인배치.csv    메인 12자리에 어느 사진을 쓸지
 *   content/문의.csv        연락처
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

  function loadCSV(name) {
    return fetch(url('content/' + name) + '?v=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('content/' + name + ' 파일을 찾을 수 없습니다');
        return r.text();
      })
      .then(parseCSV);
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
      loadCSV('사례목록.csv'), loadCSV('메인배치.csv'), loadCSV('문의.csv')
    ]).then(function (r) {
      var cases = r[0].map(function (c) {
        return {
          name: c['사례이름'], year: c['연도'], type: c['유형'],
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
      String(err && err.message || err) +
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

  return {
    all: all, find: find, url: url, photosOf: photosOf, fail: fail, why: why,
    exists: exists,
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
      });
    }
  };
})();
