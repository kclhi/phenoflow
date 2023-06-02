from starlette.applications import Starlette
from starlette.responses import JSONResponse
from api import workflow
import oyaml as yaml
import json

app = Starlette(debug=True)

def generateWorkflow(steps, nested=False):

  generatedWorkflow = workflow.initWorkflow();
  generatedWorkflowInputs = {};
  generatedSteps = [];

  if (not 'external' in steps[0]['type']): generatedWorkflowInputs['potentialCases'] = {'class':'File', 'path':'replaceMe.csv'};

  lastStepId = None
  for step in steps:
      
    if('language' in step['implementation']): 
      # Send extension of last step output to signify workflow output
      extension = None;
      language = step['implementation']['language'];

      if(step==steps[len(steps) - 1]): extension = step['outputs'][0]['extension'];

      generatedWorkflow = workflow.createWorkflowStep(generatedWorkflow, step['position'], step['name'], lastStepId, step['type'], language, extension, nested);
      lastStepId = step['name'];
      generatedWorkflowInputs['inputModule' + str(step['position'])] = {'class':'File', 'path':language + '/' + step['implementation']['fileName']};

      # ~MDC For now, we only assume one variable input to each step, the potential cases; and one variable output, the filtered potential cases.
      if(language=='python'):
        generatedStep = workflow.createPythonStep(step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string()
      elif(language=='knime'):
        generatedStep = workflow.createKNIMEStep(step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
      elif(language=='js'):
        generatedStep = workflow.createJSStep(step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
      else:
        # Handle unknown language
        generatedStep = '';

      generatedSteps.append({"name":step['name'], "type":step['type'], "workflowId":step['workflowId'], "content":generatedStep, "fileName":step['implementation']['fileName']});
    
    else:
      nestedWorkflow = generateWorkflow(step['implementation']['steps'], True);
      # Update parent workflow to accomodate nested implementation units
      nestedWorkflowInputs = nestedWorkflow['workflowInputs'];
      nestedWorkflowInputModules = [nestedWorkflowInput for nestedWorkflowInput in nestedWorkflowInputs if 'inputModule' in nestedWorkflowInput];
      for workflowInput in nestedWorkflowInputModules: generatedWorkflowInputs['inputModule'+str(step['position'])+'-'+str(list(nestedWorkflowInputModules).index(workflowInput)+1)] = {'class':'File', 'path':nestedWorkflowInputs[workflowInput]['path']};
      generatedWorkflow = workflow.createNestedWorkflowStep(generatedWorkflow, step['position'], step['name'], lastStepId, nestedWorkflow);
      lastStepId = step['name'];

      # If sent a nested workflow to generate, generate this and store it as a step (as opposed to a command line tool)
      generatedSteps.append({"name":step['name'], "type":step['type'], "workflowId":step['workflowId'], "content":yaml.dump(nestedWorkflow['workflow'], default_flow_style=False), "steps":nestedWorkflow['steps']});
  
  return {'workflow':generatedWorkflow.get_dict(), 'steps':generatedSteps, 'workflowInputs':generatedWorkflowInputs}

@app.route('/generate', methods=['POST'])
async def generate(request):
  try:
    steps = await request.json();
  except:
    steps = None;

  if(steps): 
    generatedWorkflow = generateWorkflow(steps);
    response = {"workflow": yaml.dump(generatedWorkflow['workflow'], default_flow_style=False), "steps": generatedWorkflow['steps'], "workflowInputs": yaml.dump(generatedWorkflow['workflowInputs'], default_flow_style=False)};
    print(json.dumps(response));
    return JSONResponse(response);
  else:
    return JSONResponse({});
