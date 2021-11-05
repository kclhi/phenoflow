import cwlgen, requests, uuid, time
from datetime import datetime
import oyaml as yaml

def createStep(cwl_tool, cwl_tool_docker, implementation_file_binding, cases_file_binding, type, doc, input_doc, extension, output_doc, language="knime"):

  cwl_tool.namespaces.s = "http://phenomics.kcl.ac.uk/phenoflow/";
  metadata = {'type': type}
  cwl_tool.metadata = cwlgen.Metadata(**metadata)
  cwl_tool.doc = doc
  # Assume run in Docker
  cwl_tool.requirements.append(cwl_tool_docker);
  implementation_input_file = cwlgen.CommandInputParameter("inputModule", param_type='File', input_binding=implementation_file_binding, doc=language[0].upper() + language[1:] + " implementation unit");
  cwl_tool.inputs.append(implementation_input_file)
  if("external" not in type):
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

def createGenericStep(id, docker_image, base_command, type, doc, input_doc, extension, output_doc):

  cwl_tool = cwlgen.CommandLineTool(tool_id=id, base_command=base_command);
  cwl_tool_docker = cwlgen.DockerRequirement(docker_pull = docker_image);
  implementation_file_binding = cwlgen.CommandLineBinding(position=1);
  cases_file_binding = cwlgen.CommandLineBinding(position=2);
  return createStep(cwl_tool, cwl_tool_docker, implementation_file_binding, cases_file_binding, type, doc, input_doc, extension, output_doc, base_command);

def createPythonStep(id, type, doc, input_doc, extension, output_doc):

  return createGenericStep(id, "kclhi/python:latest", "python", type, doc, input_doc, extension, output_doc);

def createJSStep(id, type, doc, input_doc, extension, output_doc):

  return createGenericStep(id, "kclhi/node:latest", "node", type, doc, input_doc, extension, output_doc);

def createNestedWorkflowStep(workflow, position, id, nested_workflow):

  file_binding = cwlgen.CommandLineBinding();

  workflow_step = cwlgen.WorkflowStep(str(position),  id+".cwl");
  nested_workflow_inputs = nested_workflow['workflow']['inputs'];
  nested_workflow_input_modules = [nested_workflow_input for nested_workflow_input in nested_workflow_inputs if 'inputModule' in nested_workflow_input];
  for workflow_input in nested_workflow_input_modules:
    workflow_step.inputs.append(cwlgen.WorkflowStepInput("inputModule"+str(list(nested_workflow_input_modules).index(workflow_input)+1), "inputModule"+str(position)+"-"+str(list(nested_workflow_input_modules).index(workflow_input)+1)));
    input_module = cwlgen.InputParameter("inputModule"+str(position)+"-"+str(list(nested_workflow_input_modules).index(workflow_input)+1), param_type='File', input_binding=file_binding, doc=nested_workflow_inputs[workflow_input]['doc']);
    workflow.inputs.append(input_module);

  # Assume nested workflow isn't first or last in workflow
  workflow_step.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source=str(position - 1) + "/output"))
  
  workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
  workflow.steps = workflow.steps + [ workflow_step ];
  
  return workflow;


def createWorkflowStep(workflow, position, id, type, language="KNIME", extension=None, nested=False):

  file_binding = cwlgen.CommandLineBinding();

  # Individual step input

  workflow_step = cwlgen.WorkflowStep(str(position), id+".cwl");
  workflow_step.inputs.append(cwlgen.WorkflowStepInput("inputModule", "inputModule" + str(position)));

  if(not "external" in type):
    if(position==1):
      workflow_step.inputs.append(cwlgen.WorkflowStepInput("potentialCases", "potentialCases"))
    else:
      workflow_step.inputs.append(cwlgen.WorkflowStepInput("potentialCases", source=str(position - 1) + "/output"))

  # Individual step output

  workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));
  workflow.steps = workflow.steps + [ workflow_step ];

  # Overall workflow input

  if(position==1 and (not "external" in type)):
    workflow_input = cwlgen.InputParameter("potentialCases", param_type='File', input_binding=file_binding, doc="Input of potential cases for processing");
    workflow.inputs.append(workflow_input);

  workflow_input = cwlgen.InputParameter("inputModule" + str(position), param_type='File', input_binding=file_binding, doc=language[0].upper() + language[1:] + " implementation unit");
  workflow.inputs.append(workflow_input);

  # Overall workflow output

  if(extension):
    workflow_output = cwlgen.WorkflowOutputParameter(param_id=('output' if nested else 'cases'), param_type="File", output_source=str(position) + "/output", output_binding=cwlgen.CommandOutputBinding(glob="*." + extension));
    workflow.outputs.append(workflow_output);

  return workflow;

def initWorkflow():
  workflow = cwlgen.Workflow()
  workflow.requirements.append(cwlgen.SubworkflowFeatureRequirement());
  return workflow;
