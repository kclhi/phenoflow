import cwlgen

def createKnimeModule(label, workflowInputEdge, dataInputEdge, type):

    cwl_tool = cwlgen.CommandLineTool(tool_id=label.lower().replace(" ", "-"), label=label.lower().replace(" ", "-"), base_command='/home/kclhi/knime_4.1.1/knime');

    cwl_tool.namespaces.s = "https://phekb.org/";

    # ~MDC Below not supported by visualiser?
    cwl_tool_docker = cwlgen.DockerRequirement(docker_pull = "kclhi/knime:amia", docker_output_dir = "/home/kclhi/.eclipse");
    # Assume run in Docker
    cwl_tool.requirements.append(cwl_tool_docker);

    cwl_tool.arguments = ['-data', '/home/kclhi/.eclipse', '-reset', '-nosplash', '-nosave', '-application', 'org.knime.product.KNIME_BATCH_APPLICATION'];

    workflow_file_binding = cwlgen.CommandLineBinding(prefix="-workflowFile=", separate=False);

    workflow_input_file = cwlgen.CommandInputParameter(workflowInputEdge, param_type='File', input_binding=workflow_file_binding, doc=workflowInputEdge);
    cwl_tool.inputs.append(workflow_input_file)

    data_file_binding = cwlgen.CommandLineBinding(prefix="-workflow.variable=dm_potential_cases,file://", separate=False, value_from=" $(inputs.potentialCases.path),String");

    data_input_file = cwlgen.CommandInputParameter(dataInputEdge, param_type='File', input_binding=data_file_binding, doc=dataInputEdge);
    cwl_tool.inputs.append(data_input_file)

    workflow_output_binding = cwlgen.CommandOutputBinding(glob="*.csv");

    output = cwlgen.CommandOutputParameter('output', doc='output of KNIME module', param_type="File", output_binding=workflow_output_binding)
    cwl_tool.outputs.append(output)

    cwl_tool.doc = label
    metadata = {'type': type}
    cwl_tool.metadata = cwlgen.Metadata(**metadata)

    cwl_tool.export(outfile="output/" + label.lower().replace(" ", "-") + ".cwl");

createKnimeModule("Read potential cases", "knimeModule", "potentialCases", "load");
createKnimeModule("Abnormal lab", "knimeModule", "potentialCases", "logic");
createKnimeModule("Case assignment 1", "knimeModule", "potentialCases", "logic");
createKnimeModule("Case assignment 2", "knimeModule", "potentialCases", "logic");
createKnimeModule("Case assignment 3", "knimeModule", "potentialCases", "logic");
createKnimeModule("Case assignment 4", "knimeModule", "potentialCases", "logic");
createKnimeModule("Case assignment 5", "knimeModule", "potentialCases", "logic");
createKnimeModule("Output cases", "knimeModule", "potentialCases", "logic");
