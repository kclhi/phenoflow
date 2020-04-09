const chai = require('chai');
chai.use(require('chai-http'));
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const request = require('request');
const got = require('got');
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const Utils = require('../util/utils');
const Workflow = require('./workflow');

describe('basic', () => {

	describe('/POST create workflow', () => {

		let workflowId;
		let name = "workflow";

		it('Workflow endpoint should be reachable.', async() => {
			await models.workflow.sync({force:true});
			workflowId = await Workflow.createWorkflow(name, "martin", "this is a special phenotype");
		});

		let stepId;

		it('Step endpoint should be reachable.', async() => {
			await models.step.sync({force:true});
			stepId = await Workflow.addStep("stepId-" + 1, "doc", "type", 1, workflowId);
		});

		it('Input endpoint should be reachable.', async() => {
			await models.input.sync({force:true});
			await Workflow.addInput("doc", stepId);
		});

		it('Output endpoint should be reachable.', async() => {
			await models.output.sync({force:true});
			await Workflow.addOutput("doc", "csv", stepId);
		});

		it('Implementation endpoint should be reachable.', async() => {
			await models.implementation.sync({force:true});
			await Workflow.addImplementation("python", stepId, "test/implementation/python/", "hello-world.py");
		});

		it('Implementation endpoint should be reachable for second implementation.', async() => {
			await Workflow.addImplementation("js", stepId, "test/implementation/js/", "hello-world.js");
		});

		//

		it('Should be able to add second step.', async() => {
			stepId = await Workflow.addStep("stepId-" + 2, "doc", "type", 2, workflowId);
		});

		it('Should be able to add input to second step', async() => {
			await Workflow.addInput("doc", stepId);
		});

		it('Should be able to add output to second step.', async() => {
			await Workflow.addOutput("doc", "csv", stepId);
		});

		it('Should be able to add implementation to second step', async() => {
			await Workflow.addImplementation("python", stepId, "test/implementation/python/", "hello-world.py");
		});

		it('Should be able to add alternative implementation to second step', async() => {
			await Workflow.addImplementation("js", stepId, "test/implementation/js/", "hello-world.js");
		});

		let workflow = "class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: Python implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: Python implementation unit\n    id: inputModule2\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.extension'\n    outputSource: 2/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n  '1':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n      - output\n    run: stepId-1.cwl\n  '2':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n    source: 1/output\n    out:\n     - output\n    run: stepId-2.cwl\n";
		let workflowInput = 	"inputModule1:\n  class: File\n  path: python/hello-world.py\ninputModule2:\n  class: File\n  path: python/hello-world.py\npotentialCases:\n  class: File\n  path: replaceMe.csv\n";
		let steps = [
			{"stepId":"stepId-1","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-1\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"},
			{"stepId":"stepId-2","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepId-2\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"}
		];
		let implementationUnits = {
			"stepId-1": "python",
			"stepId-2": "python"
		};

		let timestamp="" + Math.floor(new Date() / 1000);

		it('Create repo for push to CWL viewer.', async() => {
			// If endpoint is unreachable test can't be performed.
			const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
			try { await got(GIT_SERVER_URL, {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) return; }
			await Utils.commitPushWorkflowRepo(workflowId, timestamp, name, workflow, steps);
			expect(fs.existsSync('output/' + workflowId + "/.git")).to.be.true
		}).timeout(120000);

		it('Create visualisation from generated CWL.', async() => {
			// If endpoint is unreachable test can't be performed.
			try { await got(config.get("visualiser.URL"), {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) return; }
			let png = await Utils.getWorkflowPNGFromViewer(workflowId + timestamp, name);
			if (!png) {
				let queueLocation = await Utils.addWorkflowToViewer(workflowId + timestamp, name);
				png = await Utils.getWorkflowFromViewer(workflowId + timestamp, name, queueLocation);
			}
			expect(png).to.not.be.null;
		}).timeout(120000);

		it('Construct ZIP from generated CWL.', async() => {
			let visualise=true;
			try { await got(config.get("visualiser.URL"), {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) visualise=false; }
			await Utils.createPFZipFile(
				workflowId,
				name,
				workflow,
				workflowInput,
				implementationUnits,
				steps,
				"this is a really cool phenotype",
				visualise
			);
			expect(fs.existsSync('dist/' + name + ".zip")).to.be.true
		}).timeout(120000);

		it('Construct ZIP from generate endpoint.', async() => {
			// If endpoint is unreachable test can't be performed.
			try { await got(config.get("generator.URL"), {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) return; }
			let res = await chai.request(server).post('/phenotype/generate/' + workflowId).send({
				implementationUnits: implementationUnits
			});
			res.should.have.status(200);
			res.body.should.be.a('object');
		}).timeout(120000);

		it('Should not be able to add step with same id + workflow', async() => {
			await Workflow.notAddStep("stepId-" + 1, "doc", "type", 1, workflowId);
		});

	});

});
