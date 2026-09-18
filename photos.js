/* build.py 가 만든다. 직접 고치지 말 것 — 다시 빌드하면 덮어써진다.
 * 사진을 넣거나 빼려면 assets/<현장>/ 에 파일을 두고 `python3 build.py` 를 돌린다.
 *
 * 메인(index.html)과 시공사례(works.html)가 이 파일 하나를 같이 쓴다.
 * 예전에는 두 파일에 같은 목록이 복사돼 있어서, 사진을 늘릴 때마다 양쪽을 고쳐야 했다.
 */
var SETS = {
  geumho: {name:"금호래미안하이리버", year:"2025", imgs:["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg", "08.jpg", "09.jpg", "10.jpg", "11.jpg", "12.jpg"]},
  dmc: {name:"DMC래미안e편한세상", year:"2025", imgs:["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg", "08.jpg", "09.jpg"]},
  magok: {name:"마곡 힐스테이트", year:"2025", imgs:["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg", "08.jpg", "09.jpg", "10.jpg", "11.jpg", "12.jpg", "13.jpg", "14.jpg"]},
  manhyeon: {name:"만현마을5단지 아이파크", year:"2025", imgs:["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg", "08.jpg", "09.jpg", "10.jpg", "11.jpg", "12.jpg", "13.jpg"]},
  yeomchang: {name:"염창월드메르디앙", year:"2025", imgs:["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg"]}
};

/* 라이트박스 — 사진을 누르면 그 집 전체 컷을 세로로 펼친다.
 * 페이지에 아래 마크업이 있어야 한다:
 *   <div class="lb" id="lb"> … <b id="lb-title"> <button id="lb-close"> <div id="lb-imgs">
 *
 * 쓰는 법:  LB.bind('.ph, .cap', {onOpen: fn, onClose: fn})
 *   콜백은 메인이 자동 흐름을 멈췄다 다시 켜는 데 쓴다.
 */
var LB = (function () {
  var lb, imgs, title, lastFocus = null, hooks = {};

  function el() {
    lb = lb || document.getElementById('lb');
    imgs = imgs || document.getElementById('lb-imgs');
    title = title || document.getElementById('lb-title');
    return lb;
  }

  function isOpen() { return !!el() && lb.classList.contains('on'); }

  function open(slug) {
    var s = SETS[slug];
    if (!s || !el()) return;
    lastFocus = document.activeElement;
    title.innerHTML = s.name + '<span>' + s.year + '</span>';
    // 열 때 만든다. 55장을 처음부터 불러오지 않기 위해서.
    imgs.innerHTML = s.imgs.map(function (f) {
      return '<img src="assets/' + slug + '/' + f + '" alt="' + s.name + ' 시공 사진" loading="lazy">';
    }).join('');
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';   // 뒤 화면이 같이 밀리지 않도록
    lb.scrollTop = 0;
    lb.focus();   // 닫기 버튼이 아니라 컨테이너가 받는다(포커스 테두리가 안 그려지도록)
    if (hooks.onOpen) hooks.onOpen();
  }

  function close() {
    if (!el()) return;
    lb.classList.remove('on');
    imgs.innerHTML = '';
    document.body.style.overflow = '';
    if (hooks.onClose) hooks.onClose();
    if (lastFocus) lastFocus.focus();
  }

  function bind(selector, opts) {
    hooks = opts || {};
    if (!el()) return;
    // 손가락으로 쓸어내린 것과 누른 것을 구분한다
    document.querySelectorAll(selector).forEach(function (n) {
      var startY = 0;
      n.addEventListener('pointerdown', function (e) { startY = e.clientY; });
      n.addEventListener('pointerup', function (e) {
        if (Math.abs(e.clientY - startY) < 8) open(n.dataset.set);
      });
    });
    document.getElementById('lb-close').addEventListener('click', close);
    // 사진이 아닌 여백을 누르면 닫힌다.
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  return {open: open, close: close, isOpen: isOpen, bind: bind};
})();
