from starlette.applications import Starlette
from starlette.responses import JSONResponse
from api import workflow

app = Starlette(debug=True)

@app.route('/generate', methods=["POST"])
async def generate(request):
    generatedWorkflow = workflow.initWorkflow();
    try:
        steps = await request.json();
    except:
        steps = None;
    if ( steps ):
        generatedSteps = [];
        print(steps);
        for step in steps:
            # Send extension of last step output to signify workflow output
            extension = None;
            if ( step == steps[len(steps) - 1] ): extension = step['outputs'][0]['extension'];
            generatedWorkflow = workflow.createWorkflowStep(generatedWorkflow, step['position'], step['stepId'], step['language'], extension);
            # For now, we only assume one variable input to each step, the potential cases; and one variable output, the filtered potential cases.
            if ( step['language'] == "python" ):
                generatedSteps.append(workflow.createPythonStep(step['stepId'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string());
            elif ( step['language'] == "KNIME" ):
                generatedSteps.append(workflow.createKNIMEStep(step['stepId'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string());
        print(generatedWorkflow.export_string());
        print(generatedSteps);
    return JSONResponse("{}")
