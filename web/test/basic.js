const chai = require('chai');
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const models = require('../models');
const Utils = require('../util/utils')

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

		function addStep(done, position=1) {
			chai.request(server)
			.post('/step/new').send({
				stepId: "stepId-" + position,
				doc: "doc",
				type: "type",
				position: position,
				workflowId: workflowId
			}).end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object');
				stepId = res.body.id;
				done();
			});
		}

		it('Step endpoint should be reachable.', (done) => {
			models.step.sync({force:true}).then(function() {
				addStep(done);
			});
		});

		async function addInput(done) {
			chai.request(server).post('/input/new').send({
				inputId: "inputId",
				doc: "doc",
				stepId: stepId
			}).end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object');
				done();
			});
		}

		it('Input endpoint should be reachable.', (done) => {
			models.input.sync({force:true}).then(function() {
				addInput(done);
			});
		});

		function addOutput(done) {
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
		}

		it('Output endpoint should be reachable.', (done) => {
			models.output.sync({force:true}).then(function() {
				addOutput(done);
			});
		});

		function addImplementation(done) {
			chai.request(server).post('/implementation/new').attach('implementation', 'test/hello-world.py', '../uploads/hello-world.py').field(
				'stepId', stepId
			).field(
				'language', 'python'
			).end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object');
				done();
			});
		}

		it('Implementation endpoint should be reachable.', (done) => {
			models.implementation.sync({force:true}).then(function() {
				addImplementation(done);
			});
		});

		it('Should be able to add second step.', (done) => {
			addStep(done, 2);
		});

		it('Should be able to add input to second step', (done) => {
			addInput(done);
		});

		it('Should be able to add output to second step.', (done) => {
			addOutput(done);
		});

		it('Should be able to add implementation to second step', (done) => {
			addImplementation(done);
		});

		it('Construct ZIP from generated CWL.', async() => {
			await Utils.createZIP(
				workflowId,
				"class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: Python implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: Python implementation unit\n    id: inputModule2\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.extension'\n    outputSource: 2/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n1:\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n  - output\n    run: stepId-1.cwl\n  2:\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n source: 1/output\n    out:\n    - output\n    run: stepId-2.cwl\n",
				[{"stepId":"stepId-1","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-1\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n"},{"stepId":"stepId-2","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-2\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n"}]
			);
			expect(fs.existsSync('util/' + workflowId + ".zip")).to.be.true
		});

		it('Generate endpoint should be reachable.', (done) => {
			chai.request(server).post('/workflow/generate/' + workflowId + '/python').end((err, res) => {
				res.should.not.have.status(500);
				res.body.should.be.a('object');
				done();
			});
		});

	});

});
