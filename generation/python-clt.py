import cwlgen

def createPythonModule(label, workflowInputEdge, dataInputEdge, type):

    cwl_tool = cwlgen.CommandLineTool(tool_id=label.lower().replace(" ", "-"), label=label.lower().replace(" ", "-"), base_command='python');

    cwl_tool.namespaces.s = "https://phekb.org/";

    # ~MDC Below not supported by visualiser?
    cwl_tool_docker = cwlgen.DockerRequirement(docker_pull = "python:latest");
    # Assume run in Docker
    cwl_tool.requirements.append(cwl_tool_docker);

    workflow_file_binding = cwlgen.CommandLineBinding(position=1);

    workflow_input_file = cwlgen.CommandInputParameter(workflowInputEdge, param_type='File', input_binding=workflow_file_binding, doc=workflowInputEdge);
    cwl_tool.inputs.append(workflow_input_file)

    data_file_binding = cwlgen.CommandLineBinding(position=2);

    data_input_file = cwlgen.CommandInputParameter(dataInputEdge, param_type='File', input_binding=data_file_binding, doc=dataInputEdge);
    cwl_tool.inputs.append(data_input_file)

    workflow_output_binding = cwlgen.CommandOutputBinding(glob="*.csv");

    output = cwlgen.CommandOutputParameter('output', doc='output of KNIME module', param_type="File", output_binding=workflow_output_binding)
    cwl_tool.outputs.append(output)

    cwl_tool.doc = label
    metadata = {'type': type}
    cwl_tool.metadata = cwlgen.Metadata(**metadata)

    cwl_tool.export(outfile="output/" + label.lower().replace(" ", "-") + ".cwl");

createPythonModule("Case assignment 1 python", "inputModule", "potentialCases", "logic");
