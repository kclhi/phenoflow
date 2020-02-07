import cwlgen

knime_workflow = cwlgen.Workflow()

file_binding = cwlgen.CommandLineBinding();
workflow_input = cwlgen.InputParameter('knime1', param_type='File', input_binding=file_binding, doc='workflow file');
knime_workflow.inputs.append(workflow_input);

# Not necessary at present:
workflow_output = cwlgen.WorkflowOutputParameter('output', output_binding=cwlgen.CommandOutputBinding(output_eval=""), doc='output of full CWL Knime workflow', param_type="string")
knime_workflow.outputs.append(workflow_output)

workflow_step = cwlgen.WorkflowStep("1", "knime-clt.cwl");
workflow_step.inputs.append(cwlgen.WorkflowStepInput("workflowFile", "knime1"))
workflow_step.out.append(cwlgen.WorkflowStepOutput("output"));

knime_workflow.steps.append(workflow_step);

knime_workflow.export();
knime_workflow.export(outfile="output/knime-workflow.cwl");
