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
const Download = require('../util/download');
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

		workflowId--;

		let workflow = // ~MDC This is obviously sub-optimal...
		"class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: KNIME implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: KNIME implementation unit\n    id: inputModule2\n    type: File\n  inputModule3:\n    doc: KNIME implementation unit\n    id: inputModule3\n    type: File\n  inputModule4:\n    doc: KNIME implementation unit\n    id: inputModule4\n    type: File\n  inputModule5:\n    doc: KNIME implementation unit\n    id: inputModule5\n    type: File\n  inputModule6:\n    doc: KNIME implementation unit\n    id: inputModule6\n    type: File\n  inputModule7:\n    doc: KNIME implementation unit\n    id: inputModule7\n    type: File\n  inputModule8:\n    doc: KNIME implementation unit\n    id: inputModule8\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.csv'\n    outputSource: 8/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n  '1':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n    - output\n    run: read-potential-cases.cwl\n  '2':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n        source: 1/output\n    out:\n    - output\n    run: abnormal-lab.cwl\n  '3':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule3\n      potentialCases:\n        id: potentialCases\n        source: 2/output\n    out:\n    - output\n    run: rx_t2dm_med-abnormal-lab.cwl\n  '4':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule4\n      potentialCases:\n        id: potentialCases\n        source: 3/output\n    out:\n    - output\n    run: dx_t2dm-abnormal-lab.cwl\n  '5':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule5\n      potentialCases:\n        id: potentialCases\n        source: 4/output\n    out:\n    - output\n    run: dx_t2dm-rx_t2dm_med.cwl\n  '6':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule6\n      potentialCases:\n        id: potentialCases\n        source: 5/output\n    out:\n    - output\n    run: dx_t2dm-rx_tdm_med-prec.cwl\n  '7':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule7\n      potentialCases:\n        id: potentialCases\n        source: 6/output\n    out:\n    - output\n    run: dx_t2dm-rx_t1dm_med-dx2.cwl\n  '8':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule8\n      potentialCases:\n        id: potentialCases\n        source: 7/output\n    out:\n    - output\n    run: output-cases.cwl\n";
		let workflowInput = "inputModule1:\n  class: File\n  path: knime/read-potential-cases.knwf\ninputModule2:\n  class: File\n  path: knime/abnormal-lab.knwf\ninputModule3:\n  class: File\n  path: knime/rx_t2dm_med-abnormal-lab.knwf\ninputModule4:\n  class: File\n  path: knime/dx_t2dm-abnormal-lab.knwf\ninputModule5:\n  class: File\n  path: knime/dx_t2dm-rx_t2dm_med.knwf\ninputModule6:\n  class: File\n  path: knime/dx_t2dm-rx_tdm_med-prec.knwf\ninputModule7:\n  class: File\n  path: knime/dx_t2dm-rx_t1dm_med-dx2.knwf\ninputModule8:\n  class: File\n  path: knime/output-cases.knwf\npotentialCases:\n  class: File\n  path: replaceMe.csv\n";
		let steps = [
			{"name":"read-potential-cases","type":"load","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Read potential cases\nid: read-potential-cases\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Initial potential cases, read from disc.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: load\n","fileName":"read-potential-cases.knwf"},
			{"name":"abnormal-lab","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: An abnormal lab value is defined as one of three different exacerbations in blood\n  sugar level.\nid: abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output of patients flagged as having an abnormal lab result.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: logic\n","fileName":"abnormal-lab.knwf"},
			{"name":"rx_t2dm_med-abnormal-lab","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: An abnormal lab value is defined as one of three different exacerbations in blood\n  sugar level.\nid: rx_t2dm_med-abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"rx_t2dm_med-abnormal-lab.knwf"},
			{"name":"dx_t2dm-abnormal-lab","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: A case is identified in the presence of an abnormal lab value (defined as one\n  of three different exacerbations in blood sugar level) AND if a diagnosis of T2DM\n  is identified.\nid: dx_t2dm-abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"dx_t2dm-abnormal-lab.knwf"},
			{"name":"dx_t2dm-rx_t2dm_med","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes AND a prescription of medication for it.\nid: dx_t2dm-rx_t2dm_med\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"dx_t2dm-rx_t2dm_med.knwf"},
			{"name":"dx_t2dm-rx_tdm_med-prec","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes (by at least two physicians) AND a prescription\n  of medication for both this type, and type 1, of diabetes AND type 1 prescribed\n  prior.\nid: dx_t2dm-rx_tdm_med-prec\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"dx_t2dm-rx_tdm_med-prec.knwf"},
			{"name":"dx_t2dm-rx_t1dm_med-dx2","type":"logic","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes (by at least two physicians) AND a prescription\n  of medication for type 1 of this type of diabetes.\nid: dx_t2dm-rx_t1dm_med-dx2\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"dx_t2dm-rx_t1dm_med-dx2.knwf"},
			{"name":"output-cases","type":"output","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Output cases.\nid: output-cases\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean\n","fileName":"output-cases.knwf"}
		];
		let implementationUnits = {
			"read-potential-cases": "knime",
			"abnormal-lab": "knime",
			"rx_t2dm_med-abnormal-lab": "knime",
			"dx_t2dm-abnormal-lab": "knime",
			"dx_t2dm-rx_t2dm_med": "knime",
			"dx_t2dm-rx_tdm_med-prec": "knime",
			"dx_t2dm-rx_t1dm_med-dx2": "knime",
			"output-cases": "knime"
		};

		async function testGenerateEndpoint(workflowId, implementationUnits) {
			// If service is not running, endpoint cannot be tested.
			try { await got(config.get("generator.URL"), {method: "HEAD"}); } catch(error) { if (error.code && error.code=="ECONNREFUSED") return; }
			let res = await chai.request(server).post('/phenoflow/phenotype/generate/' + workflowId).send({implementationUnits: implementationUnits});
			res.should.have.status(200);
			res.body.should.be.a('object');
			// Handle received ZIP.
		}

		async function constructZIPFromGeneratedCWL(workflowId, name, workflow, workflowInput, implementationUnits, steps) {
			let visualise=true;
			try { await got(config.get("visualiser.URL"), {method: "HEAD"}); } catch(error) { if (error.code && error.code=="ECONNREFUSED") visualise=false; }
			await Download.createPFZipFile(workflowId, name, workflow, workflowInput, implementationUnits, steps, "Type 2 Diabetes Mellitus phenotype as a structured phenotype definition, as produced by the Phenoflow architecture.", visualise);
			expect(fs.existsSync('dist/' + name + ".zip")).to.be.true
		}

		it("Generate endpoint should be reachable.", async() => {
			await testGenerateEndpoint(workflowId, implementationUnits);
		}).timeout(120000);

		it("Construct ZIP from generated CWL.", async() => {
			await constructZIPFromGeneratedCWL(workflowId, NAME, workflow, workflowInput, implementationUnits, steps);
		}).timeout(120000);

		workflowInput = workflowInput.replace("knime/rx_t2dm_med-abnormal-lab.knwf", "python/rx_t2dm_med-abnormal-lab.py");
		steps[2] = {'name': 'rx_t2dm_med-abnormal-lab', 'content': "$namespaces:\n  s: https://phekb.org/\nbaseCommand: python\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: An abnormal lab value is defined as one of three different exacerbations in blood\n  sugar level.\nid: rx_t2dm_med-abnormal-lab\ninputs:\n- doc: Python implementation unit\n  id: inputModule\n  inputBinding:\n    position: 1\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    position: 2\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerPull: python:latest\ns:type: boolean\n", 'fileName': 'rx_t2dm_med-abnormal-lab.py'}
		implementationUnits["rx_t2dm_med-abnormal-lab"] = "python";

		it("Generate endpoint should be reachable (alternative implementation).", async() => {
			await testGenerateEndpoint(workflowId, implementationUnits);
		}).timeout(120000);

		it("Construct ZIP from generated CWL (alternative implementation).", async() => {
			await constructZIPFromGeneratedCWL(workflowId, NAME, workflow, workflowInput, implementationUnits, steps);
		}).timeout(120000);

	});

});
