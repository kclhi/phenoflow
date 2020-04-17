function processInputOutputImplementation(create, stepNode, stepId) {
  let inputDoc = stepNode.getElementsByClassName("inputDoc")[0].value;
  let outputDoc = stepNode.getElementsByClassName("outputDoc")[0].value;
  let outputExtension = stepNode.getElementsByClassName("outputExtension")[0].value;
  if (inputDoc) input(stepId, inputDoc);
  if (outputDoc && outputExtension) output(stepId, outputDoc, outputExtension);
  for (let implementationNode of stepNode.getElementsByClassName("implementation")) {
    let implementationFile = implementationNode.getElementsByClassName("implementationFile")[0].files[0];
    let implementationLanguage = implementationNode.getElementsByClassName("implementationLanguage")[0].value
    if (implementationFile && implementationLanguage) implementation(stepId, implementationLanguage, implementationFile);
  }
}

function processStep(create, stepNode, position, workflowId) {
  let stepName = stepNode.getElementsByClassName("name")[0].value
  let stepDoc = stepNode.getElementsByClassName("doc")[0].value
  let stepType;
  for (let potentialStepType of stepNode.getElementsByClassName("type")) {
    if (potentialStepType.checked) stepType = potentialStepType.value;
  }
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
  if (window.location.pathname.split("/")[4]) workflowId = window.location.pathname.split("/")[4];
  let workflowName = document.getElementsByClassName("workflowName")[0].value;
  let workflowAuthor = "martinchapman";
  let workflowAbout = document.getElementsByClassName("workflowAbout")[0].value;
  let stepNodes = document.getElementById("steps").childNodes;
  if (!workflowName || !workflowAuthor || !workflowAbout) return;
  if (!workflowId) {
    createWorkflow(workflowName, workflowAuthor, workflowAbout, function(workflowCreateResponse) {
      if (workflowCreateResponse && (workflowId=JSON.parse(workflowCreateResponse).id)) {
        history.pushState({page: 1}, "", "/phenoflow/phenotype/define/" + workflowId);
        let position = 1;
        for (let stepNode of stepNodes) {
          processStep(true, stepNode, position, workflowId);
          position++;
        }
      }
    });
  } else {
    for(let deletedStep of deletedSteps) deleteStep(workflowId, deletedStep);
    updateWorkflow(workflowId, workflowName, workflowAuthor, workflowAbout, function(workflowUpdatedResponse) {
      if (workflowUpdatedResponse) {
        let position = 1;
        for(let stepNode of stepNodes) {
          processStep(false, stepNode, position, workflowId);
          position++;
        }
      }
    });
  }
}

var inputSteps = 1;
function addStep() {
  let original = document.getElementById("step1");
  let clone = original.cloneNode(true);
  clone.id = "step" + ++inputSteps;
  clone.getElementsByClassName("name")[0].value = "";
  clone.getElementsByClassName("doc")[0].value = "";
  for (let type of clone.getElementsByClassName("type")) type.removeAttribute("checked")
  clone.getElementsByClassName("inputDoc")[0].value = "";
  clone.getElementsByClassName("outputDoc")[0].value = "";
  clone.getElementsByClassName("outputExtension")[0].value = "";
  clone.getElementsByClassName("implementationLanguage")[0].value = "-";
  clone.getElementsByClassName("implementationFileExisting")[0].style.display = "none";
  clone.getElementsByClassName("stepRemove")[0].style.display = "inline";
  for(let type of clone.getElementsByClassName("type")) {
    type.id = "step" + inputSteps + type.value;
    type.name = "step" + inputSteps + "type";
  }
  for(let typeLabel of clone.getElementsByTagName("label")) typeLabel.htmlFor = "step" + inputSteps + typeLabel.className;
  original.parentNode.appendChild(clone);
}

var deletedSteps = [];
function logDeletedStep(step) {
  step = step.parentNode.parentNode.parentNode;
  let position = 1;
  for(let potentialStep of document.getElementById("steps").childNodes) {
    if(potentialStep == step) break;
    position++;
  }
  deletedSteps.push(position);
  step.remove();
  inputSteps--;
}

function addImplementation(stepInputId) {
  let original = document.getElementById(stepInputId).getElementsByClassName("implementation")[0];
  let clone = original.cloneNode(true);
  clone.getElementsByClassName("implementationLanguage")[0].value="-";
  clone.getElementsByClassName("implementationFile")[0].value="";
  let implementationFileExisting = clone.getElementsByClassName("implementationFileExisting")?clone.getElementsByClassName("implementationFileExisting")[0]:null;
  if (implementationFileExisting ) implementationFileExisting.remove();
  original.parentNode.appendChild(clone);
}
