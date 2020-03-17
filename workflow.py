import cwlgen, requests, uuid, time
from datetime import datetime
from git import Repo

def createWorkflowStep(step, tool, input, source, moduleId=None):

    if ( moduleId == None ): moduleId = step;

    workflow_step = cwlgen.WorkflowStep(step, tool);
    workflow_step.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule" + moduleId))
    workflow_step.inputs.append(cwlgen.WorkflowStepInput(input, source=source))
    workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
    return workflow_step;

def createSubWorkflow():

    workflow = cwlgen.Workflow()

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('abnormalLab1', param_type='File', input_binding=file_binding, doc='potential cases marked with abnormal lab');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule3', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule4', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule5', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule6', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule7', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    ##

    workflow_output = cwlgen.WorkflowOutputParameter(param_id='case-assignment', param_type="File", output_source="5/output", output_binding=cwlgen.CommandOutputBinding(glob="*.csv"));
    workflow.outputs.append(workflow_output);

    ##

    workflow_step_1 = cwlgen.WorkflowStep("1", "case-assignment-1.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule3"))
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "abnormalLab1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow.steps = workflow.steps + [ \
        workflow_step_1, \
        createWorkflowStep("2", "case-assignment-2.cwl", "potentialCases", "1/output", "4"), \
        createWorkflowStep("3", "case-assignment-3.cwl", "potentialCases", "2/output", "5"), \
        createWorkflowStep("4", "case-assignment-4.cwl", "potentialCases", "3/output", "6"), \
        createWorkflowStep("5", "case-assignment-5.cwl", "potentialCases", "4/output", "7"), \
    ];

    workflowId = "w" + str(uuid.uuid1());

    workflow.export(outfile="output/" + workflowId + ".cwl");

    return workflowId;

def createWorkflow(subworkflowId):

    workflow = cwlgen.Workflow()

    workflow.requirements.append(cwlgen.SubworkflowFeatureRequirement());

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule1', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('potentialCases1', param_type='File', input_binding=file_binding, doc='potential cases file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule2', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule3', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule4', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule5', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule6', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule7', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    file_binding = cwlgen.CommandLineBinding();
    workflow_input = cwlgen.InputParameter('inputModule8', param_type='File', input_binding=file_binding, doc='data pipeline file');
    workflow.inputs.append(workflow_input);

    workflow_output = cwlgen.WorkflowOutputParameter(param_id='dm_cases', param_type="File", output_source="4/output", output_binding=cwlgen.CommandOutputBinding(glob="*.csv"));
    workflow.outputs.append(workflow_output);

    ##

    workflow_step_1 = cwlgen.WorkflowStep("1", "read-potential-cases.cwl");
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule1"))
    workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "potentialCases1"))
    workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow_step_3 = cwlgen.WorkflowStep("3", subworkflowId + ".cwl");
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("inputModule3", "inputModule3"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("inputModule4", "inputModule4"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("inputModule5", "inputModule5"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("inputModule6", "inputModule6"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("inputModule7", "inputModule7"))
    workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("abnormalLab1", source="2/output"))
    workflow_step_3.out.append(cwlgen.WorkflowStepOutput("case-assignment"));

    workflow_step_4 = cwlgen.WorkflowStep("4", "output-cases.cwl");
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule8"))
    workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source="3/case-assignment"))
    workflow_step_4.out.append(cwlgen.WorkflowStepOutput("output"));

    workflow.steps = workflow.steps + [ \
        workflow_step_1, \
        createWorkflowStep("2", "abnormal-lab.cwl", "potentialCases", "1/output"), \
        workflow_step_3, \
        workflow_step_4
    ];

    workflowId = "w" + str(uuid.uuid1());

    workflow.export(outfile="output/" + workflowId + ".cwl");

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

workflowId = createWorkflow(createSubWorkflow());
#commitPushWorkflowRepo();
#addWorkflowToViewer(workflowId + ".cwl");
