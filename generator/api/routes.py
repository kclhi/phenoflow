from starlette.applications import Starlette
from starlette.responses import JSONResponse
from api import workflow
import oyaml as yaml

app = Starlette(debug=True)

@app.route('/generate', methods=["POST"])
async def generate(request):
    generatedWorkflow = workflow.initWorkflow();
    generatedWorkflowInputs = {};
    generatedSteps = [];

    try:
        steps = await request.json();
    except:
        steps = None;

    if (steps):

        if (not "external" in steps[0]['type']): generatedWorkflowInputs["potentialCases"] = {'class':'File', 'path':'replaceMe.csv'};

        for step in steps:
            
            if('inputs' in step and 'outputs' in step): 
              # Send extension of last step output to signify workflow output
              extension = None;
              language = step['implementation']['language'];

              if (step==steps[len(steps) - 1]): extension = step['outputs'][0]['extension'];

              generatedWorkflow = workflow.createWorkflowStep(generatedWorkflow, step['position'], step['name'], step['type'], language, extension);
              generatedWorkflowInputs["inputModule" + str(step['position'])] = {'class':'File', 'path':language + "/" + step['implementation']['fileName']};

              # ~MDC For now, we only assume one variable input to each step, the potential cases; and one variable output, the filtered potential cases.
              if ( language == "python" ):
                  generatedStep = workflow.createPythonStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string()
              elif ( language == "knime" ):
                  generatedStep = workflow.createKNIMEStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
              elif ( language == "js" ):
                  generatedStep = workflow.createJSStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
              else:
                  # Handle unknown language
                  generatedStep = "";

              generatedSteps.append({"name":step['name'], "type":step['type'], "content":generatedStep, "fileName":step['implementation']['fileName']});
            
            else:
              nested_workflow_inputs = yaml.safe_load(step['implementation']['workflowInputs']);
              for workflow_input in [nested_workflow_input for nested_workflow_input in nested_workflow_inputs if 'inputModule' in nested_workflow_input]: generatedWorkflowInputs["inputModule" + str(step['position']) + "-" + str(list(nested_workflow_inputs.keys()).index(workflow_input))] = {'class':'File', 'path':nested_workflow_inputs[workflow_input]['path']};
              generatedWorkflow = workflow.createNestedWorkflowStep(generatedWorkflow, step['position'], step['implementation']);

    return JSONResponse({"workflow": yaml.dump(generatedWorkflow.get_dict(), default_flow_style=False), "steps": generatedSteps, "workflowInputs": yaml.dump(generatedWorkflowInputs, default_flow_style=False)})
