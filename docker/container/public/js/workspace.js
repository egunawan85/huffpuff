// Load user info (served by gateway, proxied through)
fetch('/api/me')
  .then(r => {
    if (!r.ok) { window.location.href = '/login.html'; return null; }
    return r.json();
  })
  .then(user => {
    if (!user) return;
    document.getElementById('user-name').textContent = user.display_name || user.email;
    if (user.avatar_url) {
      document.getElementById('user-avatar').src = user.avatar_url;
    }
  });

// Set ttyd iframe src (proxied through gateway -> container -> ttyd)
document.getElementById('terminal').src = location.origin + '/ttyd/';

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
