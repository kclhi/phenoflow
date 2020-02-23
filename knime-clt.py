import cwlgen

def createKnimeModule(label, inputEdge):

    cwl_tool = cwlgen.CommandLineTool(tool_id=label.lower().replace(" ", "-"), label=label.lower().replace(" ", "-"), base_command='knime');

    # cwl_tool_docker = cwlgen.DockerRequirement(docker_pull = "knime:latest");
    # Assume run in Docker
    # cwl_tool.hints = cwl_tool_docker;

    cwl_tool.arguments = ['-reset', '-nosplash', '-application', 'org.knime.product.KNIME_BATCH_APPLICATION'];

    file_binding = cwlgen.CommandLineBinding(prefix="-" + inputEdge + "=", separate=False);

    input_file = cwlgen.CommandInputParameter(inputEdge, param_type='File', input_binding=file_binding, doc=inputEdge);
    cwl_tool.inputs.append(input_file)

    output = cwlgen.CommandOutputParameter('output', doc='output of workflow run', param_type="stdout")
    cwl_tool.outputs.append(output)

    cwl_tool.doc = label
    metadata = {'name': 'knime', 'about' : label}
    cwl_tool.metadata = cwlgen.Metadata(**metadata)

    cwl_tool.export(outfile="output/" + label.lower().replace(" ", "-") + ".cwl");

createKnimeModule("Read potential cases", "knimeModule");
createKnimeModule("Abnormal lab", "knimeModule");
createKnimeModule("Medication prescribed and abnormal lab", "knimeModule");
createKnimeModule("TBC", "knimeModule");
