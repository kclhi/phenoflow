const createError = require("http-errors");
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const logger = require("./config/winston");
const fileUpload = require("express-fileupload");
const cron = require("node-cron");
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerDefinition = {
  openapi: '3.0.1',
  info: {
    title: 'Phenoflow API',
    version: '1.0.0',
    description:
      'Test the endpoints offered by Phenoflow.'
  },
  servers: [
    {
      url: 'http://localhost:3003',
      description: 'Development server',
    },
    {
      url: 'https://kclhi.org',
      description: 'Live server',
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    }
  }
};
const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'],
};
const swaggerSpec = swaggerJSDoc(options);
const swaggerUi = require('swagger-ui-express');
require('dotenv').config()

const models = require("./models");
const index = require("./routes");
const login = require("./routes/login");
const workflow = require("./routes/workflow");
const step = require("./routes/step");
const input = require("./routes/input");
const output = require("./routes/output");
const implementation = require("./routes/implementation");
const importer = require("./routes/importer");
const workflowUtils = require("./util/workflow");

const app = express();
app.enable('strict routing');

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(morgan("combined", {stream:logger.stream}));
app.use(bodyParser.json({extended:false, limit:'50mb'}));
app.use(bodyParser.urlencoded({limit:'50mb', extended:false, parameterLimit:50000}));
app.use(cookieParser());
app.use("/phenoflow", express.static(path.join(__dirname, "public")));

const router = express.Router();
router.use("/", index);
router.use("/login", login);
router.use("/phenotype", workflow);
router.use("/step", step);
router.use("/input", input);
router.use("/output", output);

router.use(fileUpload({createParentPath:true}));
router.use("/implementation", implementation);
router.use("/importer", importer);
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/phenoflow", router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
