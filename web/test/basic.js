const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs");
const request = require("request");
const got = require("got");
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const Visualise = require("../util/visualise");
const Download = require("../util/download");
const Workflow = require("./workflow");

describe("basic", () => {

	describe("/POST create workflow", () => {

		// Add:

		it("Should be able to add a new user.", async() => {
			await models.user.sync({force:true});
			const result = await models.user.create({name: "martinchapman", password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "https://martinchapman.co.uk"});
			result.should.be.a("object");
		});

		let workflowId;
		let name = "workflow";

		it("Should be able to add a new workflow.", async() => {
			await models.workflow.sync({force:true});
			await models.step.sync({force:true});
			await models.input.sync({force:true});
			await models.output.sync({force:true});
			await models.implementation.sync({force:true});
			workflowId = await Workflow.createWorkflow(name, "this is a special phenotype", "martinchapman");
		});

		let stepId;

		it("Should be able to add a new step, for a workflow.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "doc", "type");
		});

		it("Should be able to add a new input, for a step.", async() => {
			await Workflow.input(stepId, "doc");
		});

		it("Should be able to add a new output, for a step.", async() => {
			await Workflow.output(stepId, "doc", "csv");
		});

		it("Should be able to add a new implementation, for a step.", async() => {
			await Workflow.implementation(stepId, "python", "test/implementation/python/", "hello-world.py");
		});

		it("Should be able to add an alternative implementation, for a step.", async() => {
			await Workflow.implementation(stepId, "js", "test/implementation/js/", "hello-world.js");
		});

		// Update:

		it("Should be able to update a workflow's details.", async() => {
			await Workflow.updateWorkflow(workflowId, name, "this is an updated special phenotype", "martinchapman");
		});

		it("Should be able to update a steps's details.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "updatedStepDoc", "updatedStepType");
		});

		it("Should be able to update an input's details.", async() => {
			await Workflow.input(stepId, "updatedInputDoc");
		});

		it("Should be able to update an output's details.", async() => {
			await Workflow.output(stepId, "updatedOutputDoc", "csv");
		});

		it("Should be able to update an implementation's details", async() => {
			await Workflow.implementation(stepId, "python", "test/implementation/python/", "hello-there.py");
		});

		// Add second (and completness checks):

		it("Should be able to add second step.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 2, "stepName2", "secondStepDoc", "secondStepType");
		});

		it("Incomplete workflow (just step) should be marked as such", async() => {
			let incompleteResult = true;
			try {
				let workflow = await models.workflow.findOne({where:{id:workflowId}});
				incompleteResult = workflow.complete;
			} catch(error) {};
			expect(incompleteResult).to.be.false;
		});

		it("Should be able to add input to second step", async() => {
			await Workflow.input(stepId, "secondInputDoc");
		});

		it("Incomplete workflow (just step + input) should be marked as such", async() => {
			let incompleteResult = true;
			try {
				let workflow = await models.workflow.findOne({where:{id:workflowId}});
				incompleteResult = workflow.complete;
			} catch(error) {};
			expect(incompleteResult).to.be.false;
		});

		it("Should be able to add output to second step.", async() => {
			await Workflow.output(stepId, "secondOutputDoc", "csv");
		});

		it("Should be able to add implementation to second step", async() => {
			await Workflow.implementation(stepId, "python", "test/implementation/python/", "hello-world.py");
		});

		it("Should be able to add alternative implementation to second step", async() => {
			await Workflow.implementation(stepId, "js", "test/implementation/js/", "hello-world.js");
		});

		it("Complete workflow should be marked as such", async() => {
			let completeResult = false;
			try {
				let workflow = await models.workflow.findOne({where:{id:workflowId}});
				completeResult = workflow.complete;
			} catch(error) {};
			expect(completeResult).to.be.true;
		});

		// Delete:

		it("Should be able to delete second step.", async() => {
			await Workflow.deleteStep(workflowId, 2);
		});

		let workflow = "class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: Python implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: Python implementation unit\n    id: inputModule2\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.extension'\n    outputSource: 2/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n  '1':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n      - output\n    run: stepName1.cwl\n  '2':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n        source: 1/output\n    out:\n     - output\n    run: stepName2.cwl\n";
		let workflowInput = "inputModule1:\n  class: File\n  path: python/hello-world.py\ninputModule2:\n  class: File\n  path: python/hello-world.py\npotentialCases:\n  class: File\n  path: replaceMe.csv\n";
		let steps = [
			{"name":"stepName1","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepName1\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"},
			{"name":"stepName2","content":"$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: doc\nid: stepName2\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: doc\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: doc\n  id: output\n  outputBinding:\n    glob: '*.extension'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: type\n", "fileName": "hello-world.py"}
		];
		let implementationUnits = {
			"stepName1": "python",
			"stepName2": "python"
		};

		let timestamp="" + Math.floor(new Date() / 1000);

		it("Create repo for push to CWL viewer.", async() => {
			// If endpoint is unreachable test can't be performed.
			const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
			try { await got(GIT_SERVER_URL, {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) return; }
			await Visualise.commitPushWorkflowRepo(workflowId, timestamp, name, workflow, steps);
			expect(fs.existsSync('output/' + workflowId + "/.git")).to.be.true
		}).timeout(0);

		it("Create visualisation from generated CWL.", async() => {
			// If endpoint is unreachable test can't be performed.
			try { await got(config.get("visualiser.URL"), {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) return; }
			let png = await Visualise.getWorkflowPNGFromViewer(workflowId + timestamp, name);
			if (!png) {
				let queueLocation = await Visualise.addWorkflowToViewer(workflowId + timestamp, name);
				png = await Visualise.getWorkflowFromViewer(workflowId + timestamp, name, queueLocation);
			}
			expect(png).to.not.be.null;
		}).timeout(0);

		it("Construct ZIP from generated CWL.", async() => {
			let visualise=true;
			try { await got(config.get("visualiser.URL"), {method: "HEAD"}); } catch(error) { if ( error.code && error.code=="ECONNREFUSED" ) visualise=false; }
			await Download.createPFZipFile(
				workflowId,
				name,
				workflow,
				workflowInput,
				implementationUnits,
				steps,
				"this is a really cool phenotype",
				visualise
			);
			expect(fs.existsSync("dist/" + name + ".zip")).to.be.true
		}).timeout(0);

		it("Generate endpoint should be reachable.", async() => {
			// If service is not running, endpoint cannot be tested.
			try { await got(config.get("generator.URL"), {method: "HEAD"}); } catch(error) { if (error.code && error.code=="ECONNREFUSED") return; }
			let res = await chai.request(server).post("/phenoflow/phenotype/generate/" + workflowId).send({ implementationUnits: implementationUnits });
			res.should.have.status(200);
			res.body.should.be.a("object");
		}).timeout(0);

	});

});
