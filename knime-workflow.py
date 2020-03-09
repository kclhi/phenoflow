import cwlgen, requests, uuid, time
from datetime import datetime
from git import Repo

def createKnimeWorkflowStep(step, tool, input, source):

    workflow_step = cwlgen.WorkflowStep(step, tool);
    workflow_step.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule" + step))
    workflow_step.inputs.append(cwlgen.WorkflowStepInput(input, source=source))
    workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
    return workflow_step;

def createKnimeWorkflow():

    knime_workflow = cwlgen.Workflow()

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

    workflow_output = cwlgen.WorkflowOutputParameter(param_id='dm_cases', param_type="File", output_source="8/output", output_binding=cwlgen.CommandOutputBinding(glob="*.csv"));
    knime_workflow.outputs.append(workflow_output);

    ##

    workflow_step_1 = cwlgen.WorkflowStep("1", "read-potential-cases.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule1"))
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "potentialCases1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    knime_workflow.steps = knime_workflow.steps + [ \
        workflow_step_1, \
        createKnimeWorkflowStep("2", "abnormal-lab.cwl", "potentialCases", "1/output"), \
        createKnimeWorkflowStep("3", "case-assignment-1.cwl", "potentialCases", "2/output"), \
        createKnimeWorkflowStep("4", "case-assignment-2.cwl", "potentialCases", "3/output"), \
        createKnimeWorkflowStep("5", "case-assignment-3.cwl", "potentialCases", "4/output"), \
        createKnimeWorkflowStep("6", "case-assignment-4.cwl", "potentialCases", "5/output"), \
        createKnimeWorkflowStep("7", "case-assignment-5.cwl", "potentialCases", "6/output"), \
        createKnimeWorkflowStep("8", "output-cases.cwl", "potentialCases", "7/output")
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

workflowId = createKnimeWorkflow();
#commitPushWorkflowRepo();
#addWorkflowToViewer(workflowId + ".cwl");
