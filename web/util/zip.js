// require modules
const fs = require('fs');
const archiver = require('archiver');
const logger = require('../config/winston');

class Zip {

  // https://www.archiverjs.com/docs/quickstart
  
  static create(warningFunction=function(warning){}, errorFunction=function(error){}, endFunction=function(archiveData){}) {
    const chunks = [];
    var archive = archiver('zip', {
      zlib: { level: 9 }
    });
    archive.on('data', function(data) { 
      chunks.push(Buffer.from(data))
    });
    archive.on('warning', warningFunction);
    archive.on('error', errorFunction);
    archive.on('end', function() {
      endFunction(Buffer.concat(chunks))
    });
    return archive;
  }

  static async createFile(name) {
    let archive = Zip.create(
      function(warning) {
        if(warning.code==='ENOENT') {
          logger.error(warning);
        } else {
          throw warning;
        }
      },
      function(error) {
        throw error;
      }
    );
    let distDir = __dirname + '/../dist/';
    if(!await fs.existsSync(distDir)) await fs.mkdirSync(distDir);
    var output = fs.createWriteStream(distDir + name + '.zip');
    output.on('close', function() {
      logger.debug(archive.pointer() + ' total bytes');
      logger.debug('archiver has been finalized and the output file descriptor has closed.');
    });
    output.on('end', function() {
      logger.debug('Data has been drained');
    });
    archive.pipe(output);
    return archive;
  }

  static createResponse(name, res) {
    let archive = Zip.create(
      function(warning) {},
      function(err) {
        res.status(500).send({error: err.message});
      },
      function(archiveData) {
        let size = archive.pointer();
        res.set("Content-Length", size);
        console.log('Archive wrote %d bytes', size);

        res.send(archiveData);
      }
    );
    res.attachment(name + '.zip');
    return archive;
  }

  static add(archive, string, filename) {
    archive.append(string, { name: filename });
  }

  static addFile(archive, path, filename) {
    archive.file(path + filename, { name: filename });
  }

  static output(archive) {
    archive.finalize();
  }

}

module.exports = Zip;
