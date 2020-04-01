from starlette.applications import Starlette
from starlette.responses import JSONResponse
from generator import workflow
import uvicorn

app = Starlette(debug=True)

@app.route('/generate', methods=["POST"])
async def generate(request):
    workflowA = workflow.initWorkflow();
    return JSONResponse({
        'workflow': workflow.createWorkflowStep(workflowA, 1, "read-potential-cases").export_string(),
        'steps': [
            workflow.createPythonStep("read-potential-cases", "load", "Read potential cases", "Potential cases of this type of diabetes.", "csv", "Initial potential cases, read from disc.").export_string()
        ]
    });

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=3001)
