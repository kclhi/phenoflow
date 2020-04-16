function processInputOutputImplementation(create, stepNode, stepId) {
  let inputDoc = stepNode.getElementsByClassName('inputDoc')[0].value;
  let outputDoc = stepNode.getElementsByClassName('outputDoc')[0].value;
  let outputExtension = stepNode.getElementsByClassName('outputExtension')[0].value;
  if (inputDoc) input(stepId, inputDoc);
  if (outputDoc && outputExtension) output(stepId, outputDoc, outputExtension);
  for (let implementationNode of stepNode.getElementsByClassName("implementation")) {
    let implementationFile = implementationNode.getElementsByClassName('implementationFile')[0].files[0];
    let implementationLanguage = implementationNode.getElementsByClassName('implementationLanguage')[0].value
    if (implementationFile && implementationLanguage) implementation(stepId, implementationLanguage, implementationFile);
  }
}

function processStep(create, stepNode, position, workflowId) {
  let stepName = stepNode.getElementsByClassName('name')[0].value
  let stepDoc = stepNode.getElementsByClassName('doc')[0].value
  let stepType = stepNode.getElementsByClassName('type')[0].value
  if (!stepName || !stepDoc || !stepType) return;
  let stepId;
  step(workflowId, position, stepName, stepDoc, stepType, function(stepUpdateResponse){
    if (stepUpdateResponse && (stepId=JSON.parse(stepUpdateResponse).id)) {
      processInputOutputImplementation(false, stepNode, stepId);
    }
  });
}

function createOrUpdateWorkflow() {
  let workflowId;
  if (window.location.pathname.split('/')[3]) workflowId = window.location.pathname.split('/')[3];
  let workflowName = document.getElementById('workflow-name').value;
  let workflowAuthor = "martinchapman";
  let workflowAbout = document.getElementById('workflow-about').value;
  let stepNodes = document.getElementById('steps').childNodes;
  if (!workflowName || !workflowAuthor || !workflowAbout) return;
  if (!workflowId) {
    createWorkflow(workflowName, workflowAuthor, workflowAbout, function(workflowCreateResponse) {
      if (workflowCreateResponse && (workflowId=JSON.parse(workflowCreateResponse).id)) {
        history.pushState({page: 1}, "", "/phenotype/define/" + workflowId);
        let position = 1;
        for (let stepNode of stepNodes) {
          processStep(true, stepNode, position, workflowId);
          position++;
        }
      }
    });
  } else {
    updateWorkflow(workflowId, workflowName, workflowAuthor, workflowAbout, function(workflowUpdatedResponse) {
      if (workflowUpdatedResponse) {
        let position = 1;
        for (let stepNode of stepNodes) {
          processStep(false, stepNode, position, workflowId);
          position++;
        }
      }
    });
  }
}

var steps = 1;
function addStep() {
  let original = document.getElementById('step1');
  let clone = original.cloneNode(true);
  clone.id = "step-" + ++steps;
  original.parentNode.appendChild(clone);
}

function addImplementation(stepId) {
  let original = document.getElementById(stepId).getElementsByClassName("implementation")[0];
  let clone = original.cloneNode(true);
  let implementationFile = clone.getElementsByClassName("implementationFile")[0];
  implementationFile.value = "";
  let implementationFileExisting = clone.getElementsByClassName("implementationFileExisting")?clone.getElementsByClassName("implementationFileExisting")[0]:null;
  if (implementationFileExisting ) implementationFileExisting.remove();
  original.parentNode.appendChild(clone);
}
