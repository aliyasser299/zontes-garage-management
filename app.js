// Local preview bridge. Google Apps Script injects Scripts.html server-side.
fetch('Scripts.html')
  .then(function (response) { return response.text(); })
  .then(function (source) {
    var code = source.replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
    var script = document.createElement('script');
    script.textContent = code;
    document.body.appendChild(script);
  })
  .catch(function (error) { console.error('Unable to load the local preview.', error); });
