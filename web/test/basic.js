const chai = require('chai');
chai.use(require('chai-http'));
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');

const models = require('../models');
const logger = require('../config/winston');

const Utils = require('../util/utils');
const Workflow = require('./workflow');

describe('basic', () => {

	describe('/POST create workflow', () => {

		let workflowId;

		it('Workflow endpoint should be reachable.', async() => {
			await models.workflow.sync({force:true});
			workflowId = await Workflow.createWorkflow("martin", "this is a special phenotype");
		});

		let stepId;

		it('Step endpoint should be reachable.', async() => {
			await models.step.sync({force:true});
			stepId = await Workflow.addStep("stepId-" + 1, "doc", "type", 1, workflowId);
		});

		it('Input endpoint should be reachable.', async() => {
			await models.input.sync({force:true});
			await Workflow.addInput("inputId", "doc", stepId);
		});

		it('Output endpoint should be reachable.', async() => {
			await models.output.sync({force:true});
			await Workflow.addOutput("outputId", "doc", "extension", stepId);
		});

		it('Implementation endpoint should be reachable.', async() => {
			await models.implementation.sync({force:true});
			await Workflow.addImplementation("python", stepId);
		});

		it('Should be able to add second step.', async() => {
			stepId = await Workflow.addStep("stepId-" + 2, "doc", "type", 2, workflowId);
		});

		it('Should be able to add input to second step', async() => {
			await Workflow.addInput("inputId", "doc", stepId);
		});

		it('Should be able to add output to second step.', async() => {
			await Workflow.addOutput("outputId", "doc", "extension", stepId);
		});

		it('Should be able to add implementation to second step', async() => {
			await Workflow.addImplementation("python", stepId);
		});

		it('Construct ZIP from generated CWL.', async() => {
			await Utils.createPFZipFile(
				workflowId,
				"class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: Python implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: Python implementation unit\n    id: inputModule2\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.extension'\n    outputSource: 2/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n1:\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n  - output\n    run: stepId-1.cwl\n  2:\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n source: 1/output\n    out:\n    - output\n    run: stepId-2.cwl\n",
				"inputModule1:\n  class: File\n  path: python/hello-world.py\ninputModule2:\n  class: File\n  path: python/hello-world.py\npotentialCases:\n  class: File\n  path: ''\n 1-inputs.cwl",
				"python",
				[{"stepId":"stepId-1","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-1\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"},{"stepId":"stepId-2","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-2\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"}],
				"this is a really cool phenotype"
			);
			expect(fs.existsSync('util/' + workflowId + ".zip")).to.be.true
		});

		it('Generate endpoint should be reachable.', async() => {
			let res = await chai.request(server).get('/workflow/generate/' + workflowId + '/python');
			res.should.not.have.status(500);
			res.body.should.be.a('object');
		});

	});

});
