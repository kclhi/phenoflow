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

describe('t2dm', () => {

	describe('/POST create workflow', () => {

		let workflowId;
		let workflowName = "t2dm";

		it('Create T2DM workflow.', async() => {
			await models.workflow.sync({force:true});
			workflowId = await Workflow.createWorkflow(workflowName, "martinchapman", "Type 2 Diabetes Mellitus phenotype as a structured phenotype definition, as produced by the Phenoflow architecture");
		});

		let stepId;

		// 1. read-potential-cases

		it('Add read potential cases step.', async() => {
			await models.step.sync({force:true});
			stepId = await Workflow.addStep("read-potential-cases", "Read potential cases", "load", 1, workflowId);
		});

		it('Add read potential cases input.', async() => {
			await models.input.sync({force:true});
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add read potential cases output.', async() => {
			await models.output.sync({force:true});
			await Workflow.addOutput("Initial potential cases, read from disc.", "csv", stepId);
		});

		it('Add read potential cases implementation.', async() => {
			await models.implementation.sync({force:true});
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "read-potential-cases.knwf");
		});

		// 2. abnormal-lab

		it('Add abnormal lab step.', async() => {
			stepId = await Workflow.addStep("abnormal-lab", "An abnormal lab value is defined as one of three different exacerbations in blood sugar level.", "logic", 2, workflowId);
		});

		it('Add abnormal lab input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add abnormal lab output.', async() => {
			await Workflow.addOutput("Output of patients flagged as having an abnormal lab result.", "csv", stepId);
		});

		it('Add abnormal lab implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "abnormal-lab.knwf");
		});

		// 3. rx_t2dm_med-abnormal-lab

		it('Add rx_t2dm_med-abnormal-lab (case rule 1) step.', async() => {
			stepId = await Workflow.addStep("rx_t2dm_med-abnormal-lab", "An abnormal lab value is defined as one of three different exacerbations in blood sugar level.", "boolean-expression", 3, workflowId);
		});

		it('Add rx_t2dm_med-abnormal-lab input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add rx_t2dm_med-abnormal-lab output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add rx_t2dm_med-abnormal-lab implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "rx_t2dm_med-abnormal-lab.knwf");
		});

		// 4. dx_t2dm-abnormal-lab

		it('Add dx_t2dm-abnormal-lab (case rule 2) step.', async() => {
			stepId = await Workflow.addStep("dx_t2dm-abnormal-lab", "A case is identified in the presence of an abnormal lab value (defined as one of three different exacerbations in blood sugar level) AND if a diagnosis of T2DM is identified.", "boolean-expression", 4, workflowId);
		});

		it('Add dx_t2dm-abnormal-lab input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add dx_t2dm-abnormal-lab output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add dx_t2dm-abnormal-lab implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "dx_t2dm-abnormal-lab.knwf");
		});

		// 5. dx_t2dm-rx_t2dm_med

		it('Add dx_t2dm-rx_t2dm_med (case rule 3) step.', async() => {
			stepId = await Workflow.addStep("dx_t2dm-rx_t2dm_med", "Diagnosis of this type of diabetes AND a prescription of medication for it.", "boolean-expression", 5, workflowId);
		});

		it('Add dx_t2dm-rx_t2dm_med input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add dx_t2dm-rx_t2dm_med output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add dx_t2dm-rx_t2dm_med implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "dx_t2dm-rx_t2dm_med.knwf");
		});

		// 6. dx_t2dm-rx_tdm_med-prec

		it('Add dx_t2dm-rx_tdm_med-prec (case rule 4) step.', async() => {
			stepId = await Workflow.addStep("dx_t2dm-rx_tdm_med-prec", "Diagnosis of this type of diabetes (by at least two physicians) AND a prescription of medication for both this type, and type 1, of diabetes AND type 1 prescribed prior.", "boolean-expression", 6, workflowId);
		});

		it('Add dx_t2dm-rx_tdm_med-precinput.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add dx_t2dm-rx_tdm_med-prec output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add dx_t2dm-rx_tdm_med-prec implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "dx_t2dm-rx_tdm_med-prec.knwf");
		});

		// 7. dx_t2dm-rx_t1dm_med-dx2

		it('Add dx_t2dm-rx_t1dm_med-dx2 (case rule 5) step.', async() => {
			stepId = await Workflow.addStep("dx_t2dm-rx_t1dm_med-dx2", "Diagnosis of this type of diabetes (by at least two physicians) AND a prescription of medication for type 1 of this type of diabetes.", "boolean-expression", 7, workflowId);
		});

		it('Add dx_t2dm-rx_t1dm_med-dx2 input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add dx_t2dm-rx_t1dm_med-dx2 output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add dx_t2dm-rx_t1dm_med-dx2 implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "dx_t2dm-rx_t1dm_med-dx2.knwf");
		});

		// 8. output-cases

		it('Add output-cases step.', async() => {
			stepId = await Workflow.addStep("output-cases", "Output cases.", "boolean-expression", 8, workflowId);
		});

		it('Add output-cases input.', async() => {
			await Workflow.addInput("Potential cases of this type of diabetes.", stepId);
		});

		it('Add output-cases output.', async() => {
			await Workflow.addOutput("Output containing patients flagged as having this case of diabetes.", "csv", stepId);
		});

		it('Add output-cases implementation.', async() => {
			await Workflow.addImplementation("knime", stepId, "test/implementation/knime/", "output-cases.knwf");
		});

		it('Construct ZIP from generated CWL.', async() => {
			await Utils.createPFZipFile(
				workflowName,
				// ~MDC This is obviously sub-optimal...
				"class: Workflow\ncwlVersion: v1.0\ninputs:\n  inputModule1:\n    doc: KNIME implementation unit\n    id: inputModule1\n    type: File\n  inputModule2:\n    doc: KNIME implementation unit\n    id: inputModule2\n    type: File\n  inputModule3:\n    doc: KNIME implementation unit\n    id: inputModule3\n    type: File\n  inputModule4:\n    doc: KNIME implementation unit\n    id: inputModule4\n    type: File\n  inputModule5:\n    doc: KNIME implementation unit\n    id: inputModule5\n    type: File\n  inputModule6:\n    doc: KNIME implementation unit\n    id: inputModule6\n    type: File\n  inputModule7:\n    doc: KNIME implementation unit\n    id: inputModule7\n    type: File\n  inputModule8:\n    doc: KNIME implementation unit\n    id: inputModule8\n    type: File\n  potentialCases:\n    doc: Input of potential cases for processing\n    id: potentialCases\n    type: File\noutputs:\n  cases:\n    id: cases\n    outputBinding:\n      glob: '*.csv'\n    outputSource: 8/output\n    type: File\nrequirements:\n  SubworkflowFeatureRequirement: {}\nsteps:\n  '1':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule1\n      potentialCases:\n        id: potentialCases\n        source: potentialCases\n    out:\n    - output\n    run: read-potential-cases.cwl\n  '2':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule2\n      potentialCases:\n        id: potentialCases\n        source: 1/output\n    out:\n    - output\n    run: abnormal-lab.cwl\n  '3':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule3\n      potentialCases:\n        id: potentialCases\n        source: 2/output\n    out:\n    - output\n    run: rx_t2dm_med-abnormal-lab.cwl\n  '4':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule4\n      potentialCases:\n        id: potentialCases\n        source: 3/output\n    out:\n    - output\n    run: dx_t2dm-abnormal-lab.cwl\n  '5':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule5\n      potentialCases:\n        id: potentialCases\n        source: 4/output\n    out:\n    - output\n    run: dx_t2dm-rx_t2dm_med.cwl\n  '6':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule6\n      potentialCases:\n        id: potentialCases\n        source: 5/output\n    out:\n    - output\n    run: dx_t2dm-rx_tdm_med-prec.cwl\n  '7':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule7\n      potentialCases:\n        id: potentialCases\n        source: 6/output\n    out:\n    - output\n    run: dx_t2dm-rx_t1dm_med-dx2.cwl\n  '8':\n    in:\n      inputModule:\n        id: inputModule\n        source: inputModule8\n      potentialCases:\n        id: potentialCases\n        source: 7/output\n    out:\n    - output\n    run: output-cases.cwl\n",
				"inputModule1:\n  class: File\n  path: knime/read-potential-cases.knwf\ninputModule2:\n  class: File\n  path: knime/abnormal-lab.knwf\ninputModule3:\n  class: File\n  path: knime/rx_t2dm_med-abnormal-lab.knwf\ninputModule4:\n  class: File\n  path: knime/dx_t2dm-abnormal-lab.knwf\ninputModule5:\n  class: File\n  path: knime/dx_t2dm-rx_t2dm_med.knwf\ninputModule6:\n  class: File\n  path: knime/dx_t2dm-rx_tdm_med-prec.knwf\ninputModule7:\n  class: File\n  path: knime/dx_t2dm-rx_t1dm_med-dx2.knwf\ninputModule8:\n  class: File\n  path: knime/output-cases.knwf\npotentialCases:\n  class: File\n  path: ''\n",
				"knime",
				[
					{"stepId":"read-potential-cases","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Read potential cases\nid: read-potential-cases\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Initial potential cases, read from disc.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: load\n","fileName":"read-potential-cases.knwf"},
					{"stepId":"abnormal-lab","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: An abnormal lab value is defined as one of three different exacerbations in blood\n  sugar level.\nid: abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output of patients flagged as having an abnormal lab result.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: logic\n","fileName":"abnormal-lab.knwf"},
					{"stepId":"rx_t2dm_med-abnormal-lab","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: An abnormal lab value is defined as one of three different exacerbations in blood\n  sugar level.\nid: rx_t2dm_med-abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"rx_t2dm_med-abnormal-lab.knwf"},
					{"stepId":"dx_t2dm-abnormal-lab","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: A case is identified in the presence of an abnormal lab value (defined as one\n  of three different exacerbations in blood sugar level) AND if a diagnosis of T2DM\n  is identified.\nid: dx_t2dm-abnormal-lab\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"dx_t2dm-abnormal-lab.knwf"},
					{"stepId":"dx_t2dm-rx_t2dm_med","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes AND a prescription of medication for it.\nid: dx_t2dm-rx_t2dm_med\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"dx_t2dm-rx_t2dm_med.knwf"},
					{"stepId":"dx_t2dm-rx_tdm_med-prec","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes (by at least two physicians) AND a prescription\n  of medication for both this type, and type 1, of diabetes AND type 1 prescribed\n  prior.\nid: dx_t2dm-rx_tdm_med-prec\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"dx_t2dm-rx_tdm_med-prec.knwf"},
					{"stepId":"dx_t2dm-rx_t1dm_med-dx2","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Diagnosis of this type of diabetes (by at least two physicians) AND a prescription\n  of medication for type 1 of this type of diabetes.\nid: dx_t2dm-rx_t1dm_med-dx2\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"dx_t2dm-rx_t1dm_med-dx2.knwf"},
					{"stepId":"output-cases","content":"$namespaces:\n  s: https://phekb.org/\narguments:\n- -data\n- /home/kclhi/.eclipse\n- -reset\n- -nosplash\n- -nosave\n- -application\n- org.knime.product.KNIME_BATCH_APPLICATION\nbaseCommand: /home/kclhi/knime_4.1.1/knime\nclass: CommandLineTool\ncwlVersion: v1.0\ndoc: Output cases.\nid: output-cases\ninputs:\n- doc: KNIME implementation unit\n  id: inputModule\n  inputBinding:\n    prefix: -workflowFile=\n    separate: false\n  type: File\n- doc: Potential cases of this type of diabetes.\n  id: potentialCases\n  inputBinding:\n    prefix: -workflow.variable=dm_potential_cases,file://\n    separate: false\n    valueFrom: ' $(inputs.potentialCases.path),String'\n  type: File\noutputs:\n- doc: Output containing patients flagged as having this case of diabetes.\n  id: output\n  outputBinding:\n    glob: '*.csv'\n  type: File\nrequirements:\n  DockerRequirement:\n    dockerOutputDirectory: /home/kclhi/.eclipse\n    dockerPull: kclhi/knime:amia\ns:type: boolean-expression\n","fileName":"output-cases.knwf"}
				],
				"Type 2 Diabetes Mellitus phenotype as a structured phenotype definition, as produced by the Phenoflow architecture."
			);
			expect(fs.existsSync('dist/' + workflowName + ".zip")).to.be.true
		});

		it('Generate endpoint should be reachable.', async() => {
			let res = await chai.request(server).get('/workflow/generate/' + workflowId + '/knime');
			res.should.not.have.status(500);
			res.body.should.be.a('object');
		});

	});

});
