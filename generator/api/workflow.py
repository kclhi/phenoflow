import cwlgen, requests, uuid, time
from datetime import datetime

def createStep(cwl_tool, cwl_tool_docker, implementation_file_binding, cases_file_binding, type, doc, input_doc, extension, output_doc, language="knime"):

    cwl_tool.namespaces.s = "https://phekb.org/";
    metadata = {'type': type}
    cwl_tool.metadata = cwlgen.Metadata(**metadata)
    cwl_tool.doc = doc
    # Assume run in Docker
    cwl_tool.requirements.append(cwl_tool_docker);
    implementation_input_file = cwlgen.CommandInputParameter("inputModule", param_type='File', input_binding=implementation_file_binding, doc=language[0].upper() + language[1:] + " implementation unit");
    cwl_tool.inputs.append(implementation_input_file)
    data_input_file = cwlgen.CommandInputParameter("potentialCases", param_type='File', input_binding=cases_file_binding, doc=input_doc);
    cwl_tool.inputs.append(data_input_file)
    workflow_output_binding = cwlgen.CommandOutputBinding(glob="*." + extension);
    output = cwlgen.CommandOutputParameter('output', doc=output_doc, param_type="File", output_binding=workflow_output_binding)
    cwl_tool.outputs.append(output)
    return cwl_tool;

def createKNIMEStep(id, type, doc, input_doc, extension, output_doc):

    cwl_tool = cwlgen.CommandLineTool(tool_id=id, base_command='/home/kclhi/knime_4.1.1/knime');
    cwl_tool_docker = cwlgen.DockerRequirement(docker_pull="kclhi/knime:amia", docker_output_dir="/home/kclhi/.eclipse");
    cwl_tool.arguments = ['-data', '/home/kclhi/.eclipse', '-reset', '-nosplash', '-nosave', '-application', 'org.knime.product.KNIME_BATCH_APPLICATION'];
    implementation_file_binding = cwlgen.CommandLineBinding(prefix="-workflowFile=", separate=False);
    cases_file_binding = cwlgen.CommandLineBinding(prefix="-workflow.variable=dm_potential_cases,file://", separate=False, value_from=" $(inputs.potentialCases.path),String");
    return createStep(cwl_tool, cwl_tool_docker, implementation_file_binding, cases_file_binding, type, doc, input_doc, extension, output_doc, "knime");

def createGenericStep(id, base_command, type, doc, input_doc, extension, output_doc):

    cwl_tool = cwlgen.CommandLineTool(tool_id=id, base_command=base_command);
    cwl_tool_docker = cwlgen.DockerRequirement(docker_pull = base_command + ":latest");
    implementation_file_binding = cwlgen.CommandLineBinding(position=1);
    cases_file_binding = cwlgen.CommandLineBinding(position=2);
    return createStep(cwl_tool, cwl_tool_docker, implementation_file_binding, cases_file_binding, type, doc, input_doc, extension, output_doc, base_command);

def createPythonStep(id, type, doc, input_doc, extension, output_doc):

    return createGenericStep(id, "python", type, doc, input_doc, extension, output_doc);

def createJSStep(id, type, doc, input_doc, extension, output_doc):

    return createGenericStep(id, "node", type, doc, input_doc, extension, output_doc);

def createWorkflowStep(workflow, position, id, language="KNIME", extension=None):

    file_binding = cwlgen.CommandLineBinding();

    # Individual step input

    workflow_step = cwlgen.WorkflowStep(str(position), id + ".cwl");
    workflow_step.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule" + str(position)));

    if ( position == 1 ):
        workflow_step.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "potentialCases"))
    else:
        workflow_step.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source=str(position - 1) + "/output"))

    # Individual step output

    workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
    workflow.steps = workflow.steps + [ workflow_step ];

    # Overall workflow input

    if ( position == 1 ):
        workflow_input = cwlgen.InputParameter("potentialCases", param_type='File', input_binding=file_binding, doc="Input of potential cases for processing");
        workflow.inputs.append(workflow_input);

    workflow_input = cwlgen.InputParameter("inputModule" + str(position), param_type='File', input_binding=file_binding, doc=language[0].upper() + language[1:] + " implementation unit");
    workflow.inputs.append(workflow_input);

    # Overall workflow output

    if ( extension ):
        workflow_output = cwlgen.WorkflowOutputParameter(param_id='cases', param_type="File", output_source=str(position) + "/output", output_binding=cwlgen.CommandOutputBinding(glob="*." + extension));
        workflow.outputs.append(workflow_output);

    return workflow;

def initWorkflow():
    workflow = cwlgen.Workflow()
    workflow.requirements.append(cwlgen.SubworkflowFeatureRequirement());
    return workflow;
