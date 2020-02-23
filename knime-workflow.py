import cwlgen, requests, uuid, time
from datetime import datetime
from git import Repo

def createKnimeWorkflow():

    knime_workflow = cwlgen.Workflow()

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('knimeModule1', param_type='File', input_binding=file_binding, doc='data pipeline file');
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

    # Not necessary at present:
    workflow_output = cwlgen.WorkflowOutputParameter('output', output_binding=cwlgen.CommandOutputBinding(output_eval="${}"), doc='output of full CWL Knime workflow', param_type="string")
    #knime_workflow.outputs.append(workflow_output)

    workflow_step_1 = cwlgen.WorkflowStep("1", "read-potential-cases.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow_step_2 = cwlgen.WorkflowStep("2", "abnormal-lab.cwl");
    workflow_step_2.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule2"))
    workflow_step_2.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source="1/output"))
    workflow_step_2.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow_step_3 = cwlgen.WorkflowStep("3", "medication-prescribed-and-abnormal-lab.cwl");
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule3"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("identifiedAbnormalLab", source="2/output"))
    workflow_step_3.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow_step_4 = cwlgen.WorkflowStep("4", "tbc.cwl");
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("knimeModule", "knimeModule4"))
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("identifiedPrescriptions", source="3/output"))
    workflow_step_4.out.append(cwlgen.WorkflowStepOutput("output"));

    knime_workflow.steps = knime_workflow.steps + [workflow_step_1, workflow_step_2, workflow_step_3, workflow_step_4];

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
commitPushWorkflowRepo();
#addWorkflowToViewer(workflowId + ".cwl");
