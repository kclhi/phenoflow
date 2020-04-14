function processInputOutputImplementation(create, stepNode, stepId) {
  let inputDoc = stepNode.getElementsByTagName('input')[2].value;
  let outputDoc = stepNode.getElementsByTagName('input')[3].value;
  let outputExtension = stepNode.getElementsByTagName('input')[4].value;
  let implementationFile = stepNode.getElementsByTagName('input')[5].files[0];
  let implementationLanguage = stepNode.getElementsByTagName('input')[6].value
  if (inputDoc) input(stepId, inputDoc);
  if (outputDoc && outputExtension) output(stepId, outputDoc, outputExtension);
  if (implementationFile && implementationLanguage) implementation(stepId, implementationLanguage, implementationFile);
}

function processStep(create, stepNode, position, workflowId) {
  let stepName = stepNode.getElementsByTagName('input')[0].value
  let stepDoc = stepNode.getElementsByTagName('input')[1].value
  let stepType = stepNode.getElementsByTagName('select')[0].value
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
  let workflowAuthor = "martin";
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
        }
      }
    });
  } else {
    updateWorkflow(workflowId, workflowName, workflowAuthor, workflowAbout, function(workflowUpdatedResponse) {
      if (workflowUpdatedResponse) {
        let position = 1;
        for (let stepNode of stepNodes) {
          processStep(false, stepNode, position, workflowId);
        }
      }
    });
  }
}

var steps = 1;
function addStep() {
  var original = document.getElementById('step-1');
  var clone = original.cloneNode(true);
  clone.id = "step-" + ++steps;
  original.parentNode.appendChild(clone);
}
