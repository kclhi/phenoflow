function createOrUpdateInputOutputImplementation(create, step, stepId) {
  let inputDoc = step.getElementsByTagName('input')[2].value;
  let outputDoc = step.getElementsByTagName('input')[3].value;
  let outputExtension = step.getElementsByTagName('input')[4].value;
  let implementationFile = step.getElementsByTagName('input')[5].files[0];
  let implementationLanguage = step.getElementsByTagName('input')[6].value
  if (create) {
    createInput(inputDoc, stepId);
    createOutput(outputDoc, outputExtension, stepId);
    createImplementation(implementationFile, implementationLanguage, stepId, implementationLanguage);
  } else {
    updateInput(inputDoc, stepId);
    updateOutput(outputDoc, outputExtension, stepId);
    updateImplementation(implementationFile, implementationLanguage, stepId, implementationLanguage);
  }
}

function createOrUpdateStep(create, step, position, workflowId) {
  let stepName = step.getElementsByTagName('input')[0].value
  let stepDoc = step.getElementsByTagName('input')[1].value
  let stepType = step.getElementsByTagName('select')[0].value
  if (!stepName || !stepDoc || !stepType) return;
  let stepId;
  if (create) {
    createStep(stepName, stepDoc, stepType, position, workflowId, function(stepCreateResponse){
      if (stepCreateResponse && (stepId = JSON.parse(stepCreateResponse).id)) {
        createOrUpdateInputOutputImplementation(true, step, stepId);
      }
    });
  } else {
    updateStep(stepName, stepDoc, stepType, position, workflowId, position, function(stepUpdateResponse){
      if (stepUpdateResponse && (stepId=JSON.parse(stepUpdateResponse).id)) {
        createOrUpdateInputOutputImplementation(false, step, stepId);
      }
    });
  }
}

function createOrUpdateWorkflow() {
  let workflowId;
  if (window.location.pathname.split('/')[3]) workflowId = window.location.pathname.split('/')[3];
  let workflowName = document.getElementById('workflow-name').value;
  let workflowAuthor = "martin";
  let workflowAbout = document.getElementById('workflow-about').value;
  let steps = document.getElementById('steps').childNodes;
  if (!workflowName || !workflowAuthor || !workflowAbout) return;
  if (!workflowId) {
    createWorkflow(workflowName, workflowAuthor, workflowAbout, function(workflowCreateResponse) {
      if (workflowCreateResponse && (workflowId=JSON.parse(workflowCreateResponse).id)) {
        history.pushState({page: 1}, "title 1", "/phenotype/define/" + workflowId);
        let position = 1;
        for (let step of steps) {
          createOrUpdateStep(true, step, position, workflowId);
        }
      }
    });
  } else {
    updateWorkflow(workflowId, workflowName, workflowAuthor, workflowAbout, function(workflowUpdatedResponse) {
      console.log(workflowUpdatedResponse);
      if (workflowUpdatedResponse) {
        let position = 1;
        for (let step of steps) {
          createOrUpdateStep(false, step, position, workflowId);
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
