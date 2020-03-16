import cwlgen, requests, uuid, time
from datetime import datetime
from git import Repo

def createKnimeWorkflowStep(step, tool, input, source, moduleId=None):

    if ( moduleId == None ): moduleId = step;

    workflow_step = cwlgen.WorkflowStep(step, tool);
    workflow_step.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule" + moduleId))
    workflow_step.inputs.append(cwlgen.WorkflowStepInput(input, source=source))
    workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
    return workflow_step;

def createKnimeSubWorkflow():

    knime_workflow = cwlgen.Workflow()

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('abnormalLab1', param_type='File', input_binding=file_binding, doc='potential cases marked with abnormal lab');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule3', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule4', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule5', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule6', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule7', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    ##

    workflow_output = cwlgen.WorkflowOutputParameter(param_id='case-assignment', param_type="File", output_source="5/output", output_binding=cwlgen.CommandOutputBinding(glob="*.csv"));
    knime_workflow.outputs.append(workflow_output);

    ##

    workflow_step_1 = cwlgen.WorkflowStep("1", "case-assignment-1.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule3"))
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "abnormalLab1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    knime_workflow.steps = knime_workflow.steps + [ \
        workflow_step_1, \
        createKnimeWorkflowStep("2", "case-assignment-2.cwl", "potentialCases", "1/output", "4"), \
        createKnimeWorkflowStep("3", "case-assignment-3.cwl", "potentialCases", "2/output", "5"), \
        createKnimeWorkflowStep("4", "case-assignment-4.cwl", "potentialCases", "3/output", "6"), \
        createKnimeWorkflowStep("5", "case-assignment-5.cwl", "potentialCases", "4/output", "7"), \
    ];

    workflowId = "w" + str(uuid.uuid1());

    knime_workflow.export(outfile="output/" + workflowId + ".cwl");

    return workflowId;

def createKnimeWorkflow(subworkflowId):

    knime_workflow = cwlgen.Workflow()

    knime_workflow.requirements.append(cwlgen.SubworkflowFeatureRequirement());

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule1', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('potentialCases1', param_type='File', input_binding=file_binding, doc='potential cases file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule2', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule3', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule4', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule5', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule6', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule7', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule8', param_type='File', input_binding=file_binding, doc='data pipeline file');
    knime_workflow.inputs.append(workflow_input);

    workflow_output = cwlgen.WorkflowOutputParameter(param_id='dm_cases', param_type="File", output_source="4/output", output_binding=cwlgen.CommandOutputBinding(glob="*.csv"));
    knime_workflow.outputs.append(workflow_output);

    ##

    workflow_step_1 = cwlgen.WorkflowStep("1", "read-potential-cases.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule1"))
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "potentialCases1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow_step_3 = cwlgen.WorkflowStep("3", subworkflowId + ".cwl");
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule3", "knimeModule3"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule4", "knimeModule4"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule5", "knimeModule5"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule6", "knimeModule6"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule7", "knimeModule7"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("abnormalLab1", source="2/output"))
    workflow_step_3.out.append(cwlgen.WorkflowStepOutput("case-assignment"));

    workflow_step_4 = cwlgen.WorkflowStep("4", "output-cases.cwl");
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule8"))
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source="3/case-assignment"))
    workflow_step_4.out.append(cwlgen.WorkflowStepOutput("output"));

    knime_workflow.steps = knime_workflow.steps + [ \
        workflow_step_1, \
        createKnimeWorkflowStep("2", "abnormal-lab.cwl", "potentialCases", "1/output"), \
        workflow_step_3, \
        workflow_step_4
    ];

    workflowId = "w" + str(uuid.uuid1());

    knime_workflow.export(outfile="output/" + workflowId + ".cwl");

    return workflowId;

def commitPushWorkflowRepo():

    repo = Repo("./output")
    assert not repo.bare
    repo.git.add(A=True)
    repo.git.commit('-m', 'Update', author='contact@martinchapman.co.uk')
    origin = repo.remote(name='origin')
    origin.push()

def addWorkflowToViewer(workflowFile):

    headers = {'accept': 'application/json'}
    payload = {
        "url": "http://git-server:7005/workflows.git",
        "branch": "master",
        "path": workflowFile
    }
    r = requests.post("http://localhost:8080/workflows", headers=headers, data=payload)
    print("Response: " + r.text)

workflowId = createKnimeWorkflow(createKnimeSubWorkflow());
#commitPushWorkflowRepo();
#addWorkflowToViewer(workflowId + ".cwl");
