const chai = require('chai');
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const models = require('../models');

chai.use(require('chai-http'));

describe('basic', () => {

	describe('/POST create workflow', () => {

		let workflowId;

		it('Workflow endpoint should be reachable.', (done) => {
			models.workflow.sync({force:true}).then(function() {
				chai.request(server).post('/workflow/new').send({ author: "martin" }).end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					workflowId = res.body.id;
					done();
				});
      })
      .error(function(error) {
        done(error);
      });
		});

		let stepId;

		it('Step endpoint should be reachable.', (done) => {
			models.step.sync({force:true}).then(function() {
				chai.request(server)
				.post('/step/new').send({
					stepId: "stepId",
					doc: "doc",
					type: "type",
					language: "language",
					position: 1,
					workflowId: workflowId
				}).end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					stepId = res.body.id;
					done();
				});
			});
		});

		it('Input endpoint should be reachable.', (done) => {
			models.input.sync({force:true}).then(function() {
				chai.request(server).post('/input/new').send({
					inputId: "inputId",
					doc: "doc",
					stepId: stepId
				}).end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					done();
				});
			});
		});

		it('Output endpoint should be reachable.', (done) => {
			models.output.sync({force:true}).then(function() {
				chai.request(server).post('/output/new').send({
					outputId: "outputId",
					doc: "doc",
					extension: "extension",
					stepId: stepId
				}).end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					done();
				});
			});
		});

		it('Implementation endpoint should be reachable.', (done) => {
			models.implementation.sync({force:true}).then(function() {
				chai.request(server).post('/implementation/new').attach('implementation', 'test/hello-world.py', 'hello-world.py').end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object');
					done();
				});
			});
		});

	});

});
