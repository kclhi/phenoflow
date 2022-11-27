const chai = require("chai");
chai.use(require("chai-http"));
const expect = chai.expect;
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");

const Workflow = require("./workflow");
const WorkflowUtils = require("../util/workflow");
const Implementation = require('../util/implementation');

describe("basic", () => {

	describe("/POST create workflow", () => {

		// Add:
    
		it("[TB1] Should be able to add a new user.", async() => {
			await models.sequelize.sync({force:true});
			const result = await models.user.create({name: "martinchapman", password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "https://martinchapman.co.uk"});
			result.should.be.a("object");
		}).timeout(0);

		let workflowId;
		let name = "workflow";

		it("Should be able to add a new workflow.", async() => {
			workflowId = await Workflow.createWorkflow(name, "this is a special phenotype", "martinchapman", 1);
		});

		let stepId;

		it("Should be able to add a new step, for a workflow.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "doc", "logic");
		});

		it("Should be able to add a new input, for a step.", async() => {
			await Workflow.input(stepId, "doc");
		});

		it("Should be able to add a new output, for a step.", async() => {
			await Workflow.output(stepId, "doc", "csv");
		});

		it("Should be able to add a new implementation, for a step.", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py");
		});

		it("Should be able to add an alternative implementation, for a step.", async() => {
			await Workflow.implementation(stepId, "js", "test/fixtures/basic/js/", "hello-world.js");
		});

		// Update:

		it("Should be able to update a workflow's details.", async() => {
			await Workflow.updateWorkflow(workflowId, name, "this is an updated special phenotype", "martinchapman");
		});

		it("Should be able to update a steps's details.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "updatedStepDoc", "logic");
		});

		it("Should be able to update an input's details.", async() => {
			await Workflow.input(stepId, "updatedInputDoc");
		});

		it("Should be able to update an output's details.", async() => {
			await Workflow.output(stepId, "updatedOutputDoc", "csv");
		});

		it("Should be able to update an implementation's details.", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-there.py");
		});

		// Add second (and completness checks):

		it("Should be able to add second step.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 2, "stepName2", "secondStepDoc", "logic");
		});

		it("Incomplete workflow (just step) should be marked as such.", async() => {
			let incompleteResult = true;
			try {
				let workflow = await models.workflow.findOne({where:{id:workflowId}});
				incompleteResult = workflow.complete;
			} catch(error) {};
			expect(incompleteResult).to.be.false;
		});

		it("Should be able to add input to second step.", async() => {
			await Workflow.input(stepId, "secondInputDoc");
		});

		it("Incomplete workflow (just step + input) should be marked as such.", async() => {
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

		it("Should be able to add implementation to second step.", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py");
		});

		it("Should be able to add alternative implementation to second step.", async() => {
			await Workflow.implementation(stepId, "js", "test/fixtures/basic/js/", "hello-world.js");
		});

		it("Complete workflow should be marked as such.", async() => {
			let completeResult = false;
			try {
				let workflow = await models.workflow.findOne({where:{id:workflowId}});
				completeResult = workflow.complete;
			} catch(error) {};
			expect(completeResult).to.be.true;
		});

		// Child workflows:
    let firstWorkflowId;

		it("Should be able to add a second workflow.", async() => {
      firstWorkflowId = workflowId;
			workflowId = await Workflow.createWorkflow(name, "this is a special phenotype", "martinchapman");
		});

		it("Should be able to add second step (of a second workflow).", async() => {
			stepId = await Workflow.upsertStep(workflowId, 2, "stepName2-second", "secondStepDoc", "logic");
		});

		it("Should be able to add input to second step (of a second workflow).", async() => {
			await Workflow.input(stepId, "secondInputDoc");
		});

		it("Should be able to add output to second step (of a second workflow).", async() => {
			await Workflow.output(stepId, "secondOutputDoc", "csv");
		});

		it("Should be able to add implementation to second step (of a second workflow).", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py");
		});

		let workflows;

		it("Should be able to add a new step, for a second workflow.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "updatedStepDoc", "logic");
		});

		it("Should be able to add a new input, for a step (of a second workflow).", async() => {
			await Workflow.input(stepId, "updatedInputDoc");
		});

		it("Should be able to add a new output, for a step (of a second workflow).", async() => {
			await Workflow.output(stepId, "updatedOutputDoc", "csv");
		});

		it("Should be able to add a new implementation, for a step (of a second workflow).", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py");
		});

    // Delete:

		it("Should be able to delete a step.", async() => {
			await Workflow.deleteStep(firstWorkflowId, 1);
		});

		//

		it("Should be able to add a third workflow.", async() => {
			workflowId = await Workflow.createWorkflow(name, "this is a special phenotype", "martinchapman");
		});

		it("Should be able to add second step (of a third workflow).", async() => {
			stepId = await Workflow.upsertStep(workflowId, 2, "stepName2", "secondStepDoc", "logic");
		});

		it("Should be able to add input to second step (of a third workflow).", async() => {
			await Workflow.input(stepId, "secondInputDoc");
		});

		it("Should be able to add output to second step (of a third workflow).", async() => {
			await Workflow.output(stepId, "secondOutputDoc", "csv");
		});

		it("Should be able to add implementation to second step (of a third workflow).", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py");
		});

    //

    it("Should be able to add a user with restricted definitions.", async() => {
			const result = await models.user.create({name: "restrictedUser", password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "", restricted:true});
			result.should.be.a("object");
		});

    it("Should be able to add a restricted workflow.", async() => {
			workflowId = await Workflow.createWorkflow(name, "this is a special phenotype", "restrictedUser");
		});

		it("Should be able to add first step (of a restricted workflow).", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "stepName1", "firstStepDoc", "logic", "restrictedUser");
		});

		it("Should be able to add input to first step (of a restricted workflow).", async() => {
			await Workflow.input(stepId, "firstInputDoc", "restrictedUser");
		});

		it("Should be able to add output to first step (of a restricted workflow).", async() => {
			await Workflow.output(stepId, "firstOutputDoc", "csv", "restrictedUser");
		});

		it("Should be able to add implementation to first step (of a restricted workflow).", async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/basic/python/", "hello-world.py", "restrictedUser");
		}).timeout(0);

    // 

    it("Should be able to aggregate codes in an implementation.", async() => {
      let codes = await Implementation.getCodes(firstWorkflowId);
			expect(JSON.stringify(codes)).to.equal(JSON.stringify([{"system":"read/snomed", "codes": ["abc", "def", "ghi"]}, {"system":"icd/opcs/cpt", "codes":[]}]));
		});

	});

});
