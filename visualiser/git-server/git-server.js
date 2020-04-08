const path = require('path');
const fs = require('fs');
const Server = require('node-git-server');

const repos = new Server(path.resolve(__dirname, 'tmp'), {
  autoCreate: true
});
const port = process.env.PORT || 7005;

repos.on('push', (push) => {
    console.log(`push ${push.repo}/${push.commit} (${push.branch})`);
    push.accept();
});

repos.on('fetch', (fetch) => {
    console.log(`fetch ${fetch.commit}`);
    fetch.accept();
});

repos.listen(port, {
  type: "https",
  key: fs.readFileSync(path.resolve(__dirname, 'git-server-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'git-server-cert.pem'))
}, () => {
    console.log(`node-git-server running at https://localhost:${port}`)
});
