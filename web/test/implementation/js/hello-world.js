var fs = require('fs');
fs.open('hello-wolrd.csv', 'w', function (err, file) {
  if (err) throw err;
});
