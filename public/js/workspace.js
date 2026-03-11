// Load config and set ttyd iframe src
fetch('/api/config')
  .then(r => r.json())
  .then(config => {
    const host = location.hostname;
    document.getElementById('terminal').src = 'http://' + host + ':' + config.ttydPort;
  });

// Resizable divider
(function () {
  var divider = document.getElementById('divider');
  var claude = document.getElementById('claude-panel');
  var cover = document.getElementById('cover');

  divider.addEventListener('mousedown', function (e) {
    e.preventDefault();
    divider.classList.add('active');
    cover.classList.add('active');

    function onMove(e) {
      var pct = (e.clientX / window.innerWidth) * 100;
      if (pct < 20) pct = 20;
      if (pct > 90) pct = 90;
      claude.style.width = pct + '%';
    }

    function onUp() {
      divider.classList.remove('active');
      cover.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();
