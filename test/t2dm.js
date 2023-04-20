const chai = require('chai');
chai.use(require('chai-http'));
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const got = require('got');
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const Workflow = require('./workflow');

describe('t2dm', () => {

	describe('/POST create T2DM workflow', () => {

		let workflowId, stepId;
		const NAME = "t2dm";
		const USERNAME = "phekb";

		async function createT2DMPhenotype() {

			// 2. abnormal-lab

			it('Add abnormal lab step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 2, "abnormal-lab", "An abnormal lab value is defined as one of three different exacerbations in blood sugar level.", "logic", USERNAME);
			});

			it('Add abnormal lab input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add abnormal lab output.', async() => {
				await Workflow.output(stepId, "Output of patients flagged as having an abnormal lab result.", "csv", USERNAME);
			});

			it('Add abnormal lab implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "abnormal-lab.knwf", USERNAME);
			});

			// 3. rx_t2dm_med-abnormal-lab

			it('Add rx_t2dm_med-abnormal-lab (case rule 1) step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 3, "rx_t2dm_med-abnormal-lab", "An abnormal lab value is defined as one of three different exacerbations in blood sugar level.", "boolean", USERNAME);
			});

			it('Add rx_t2dm_med-abnormal-lab input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add rx_t2dm_med-abnormal-lab output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this case of diabetes.", "csv", USERNAME);
			});

			it('Add rx_t2dm_med-abnormal-lab implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "rx_t2dm_med-abnormal-lab.knwf", USERNAME);
			});

			it('Add rx_t2dm_med-abnormal-lab alternative implementation.', async() => {
				await Workflow.implementation(stepId, "python", "test/fixtures/t2dm/python/", "rx_t2dm_med-abnormal-lab.py", USERNAME);
			});

			// 4. dx_t2dm-abnormal-lab

			it('Add dx_t2dm-abnormal-lab (case rule 2) step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 4, "dx_t2dm-abnormal-lab", "A case is identified in the presence of an abnormal lab value (defined as one of three different exacerbations in blood sugar level) AND if a diagnosis of T2DM is identified.", "boolean", USERNAME);
			});

			it('Add dx_t2dm-abnormal-lab input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add dx_t2dm-abnormal-lab output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this case of diabetes.", "csv", USERNAME);
			});

			it('Add dx_t2dm-abnormal-lab implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "dx_t2dm-abnormal-lab.knwf", USERNAME);
			});

			// 5. dx_t2dm-rx_t2dm_med

			it('Add dx_t2dm-rx_t2dm_med (case rule 3) step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 5, "dx_t2dm-rx_t2dm_med", "Diagnosis of this type of diabetes AND a prescription of medication for it.", "boolean", USERNAME);
			});

			it('Add dx_t2dm-rx_t2dm_med input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add dx_t2dm-rx_t2dm_med output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this case of diabetes.", "csv", USERNAME);
			});

			it('Add dx_t2dm-rx_t2dm_med implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "dx_t2dm-rx_t2dm_med.knwf", USERNAME);
			});

			// 6. dx_t2dm-rx_tdm_med-prec

			it('Add dx_t2dm-rx_tdm_med-prec (case rule 4) step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 6, "dx_t2dm-rx_tdm_med-prec", "Diagnosis of this type of diabetes (by at least two physicians) AND a prescription of medication for both this type, and type 1, of diabetes AND type 1 prescribed prior.", "boolean", USERNAME);
			});

			it('Add dx_t2dm-rx_tdm_med-precinput.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add dx_t2dm-rx_tdm_med-prec output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this case of diabetes.", "csv", USERNAME);
			});

			it('Add dx_t2dm-rx_tdm_med-prec implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "dx_t2dm-rx_tdm_med-prec.knwf", USERNAME);
			});

			// 7. dx_t2dm-rx_t1dm_med-dx2

			it('Add dx_t2dm-rx_t1dm_med-dx2 (case rule 5) step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 7, "dx_t2dm-rx_t1dm_med-dx2", "Diagnosis of this type of diabetes (by at least two physicians) AND a prescription of medication for type 1 of this type of diabetes.", "boolean", USERNAME);
			});

			it('Add dx_t2dm-rx_t1dm_med-dx2 input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add dx_t2dm-rx_t1dm_med-dx2 output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this case of diabetes.", "csv", USERNAME);
			});

			it('Add dx_t2dm-rx_t1dm_med-dx2 implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "dx_t2dm-rx_t1dm_med-dx2.knwf", USERNAME);
			});

			// 8. output-cases

			it('Add output-cases step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 8, "output-cases", "Output cases.", "output", USERNAME);
			});

			it('Add output-cases input.', async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it('Add output-cases output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having this type of diabetes.", "csv", USERNAME);
			});

			it('Add output-cases implementation.', async() => {
				await Workflow.implementation(stepId, "knime", "test/fixtures/t2dm/knime/", "output-cases.knwf", USERNAME);
			});

		}

		async function createInput(targetDatasource, implementationLangauge, implementationLangaugeExtension) {

			// 1. read-potential-cases

			it("Add read potential cases step (" + targetDatasource + ").", async() => {
				stepId = await Workflow.upsertStep(workflowId, 1, "read-potential-cases", "Read potential cases from " + targetDatasource, "load", USERNAME);
			});

			it("Add read potential cases input (" + targetDatasource + ").", async() => {
				await Workflow.input(stepId, "Potential cases of this type of diabetes.", USERNAME);
			});

			it("Add read potential cases output (" + targetDatasource + ").", async() => {
				await Workflow.output(stepId, "Initial potential cases, read from " + targetDatasource + ".", "csv", USERNAME);
			});

			it("Add read potential cases implementation (" + targetDatasource + ").", async() => {
				await Workflow.implementation(stepId, implementationLangauge, "test/fixtures/t2dm/" + implementationLangauge + "/", "read-potential-cases-" + targetDatasource + "." + implementationLangaugeExtension, USERNAME);
			});

		}

		it("[D1] Should be able to add a new user.", async() => {
			const result = await models.user.findOrCreate({
        where: {name:"phekb"},
        defaults: {name:"phekb", password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://phekb.org"}
      });
			result.should.be.a("Array");
		});

		// First T2DM phenotype

		it('Create T2DM workflow.', async() => {
			workflowId = await Workflow.createWorkflow(NAME, "Type 2 Diabetes Mellitus", "phekb", USERNAME);
		});

		createInput("disc", "knime", "knwf")
		createT2DMPhenotype();

	});

});
