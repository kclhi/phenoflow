import cwlgen

knime_workflow = cwlgen.Workflow()

file_binding = cwlgen.CommandLineBinding();
workflow_input = cwlgen.InputParameter('knime1', param_type='File', input_binding=file_binding, doc='workflow file');
knime_workflow.inputs.append(workflow_input);

file_binding = cwlgen.CommandLineBinding();
workflow_input = cwlgen.InputParameter('knime2', param_type='File', input_binding=file_binding, doc='workflow file');
knime_workflow.inputs.append(workflow_input);

file_binding = cwlgen.CommandLineBinding();
workflow_input = cwlgen.InputParameter('knime3', param_type='File', input_binding=file_binding, doc='workflow file');
knime_workflow.inputs.append(workflow_input);

file_binding = cwlgen.CommandLineBinding();
workflow_input = cwlgen.InputParameter('knime4', param_type='File', input_binding=file_binding, doc='workflow file');
knime_workflow.inputs.append(workflow_input);

# Not necessary at present:
workflow_output = cwlgen.WorkflowOutputParameter('output', output_binding=cwlgen.CommandOutputBinding(output_eval="${}"), doc='output of full CWL Knime workflow', param_type="string")
#knime_workflow.outputs.append(workflow_output)

workflow_step_1 = cwlgen.WorkflowStep("1", "knime-clt.cwl");
workflow_step_1.inputs.append(cwlgen.WorkflowStepInput("workflowFile", "knime1"))
workflow_step_1.out.append(cwlgen.WorkflowStepOutput("output"));

workflow_step_2 = cwlgen.WorkflowStep("2", "knime-clt.cwl");
workflow_step_2.inputs.append(cwlgen.WorkflowStepInput("workflowFile", "knime2"))
workflow_step_2.inputs.append(cwlgen.WorkflowStepInput("lastStepOutput", source="1/output"))
workflow_step_2.out.append(cwlgen.WorkflowStepOutput("output"));

workflow_step_3 = cwlgen.WorkflowStep("3", "knime-clt.cwl");
workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("workflowFile", "knime3"))
workflow_step_3.inputs.append(cwlgen.WorkflowStepInput("lastStepOutput", source="2/output"))
workflow_step_3.out.append(cwlgen.WorkflowStepOutput("output"));

workflow_step_4 = cwlgen.WorkflowStep("4", "knime-clt.cwl");
workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("workflowFile", "knime4"))
workflow_step_4.inputs.append(cwlgen.WorkflowStepInput("lastStepOutput", source="3/output"))
workflow_step_4.out.append(cwlgen.WorkflowStepOutput("output"));


knime_workflow.steps = knime_workflow.steps + [workflow_step_1, workflow_step_2, workflow_step_3, workflow_step_4];

knime_workflow.export();
knime_workflow.export(outfile="output/knime-workflow.cwl");
