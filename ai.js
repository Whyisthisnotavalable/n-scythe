(function() {
    const inputSize = 14;
    const hiddenSize = 20;
    const outputSize = 7;

    let weightsInputHidden = new Array(inputSize).fill(0).map(() => new Array(hiddenSize).fill(0));
    let biasesHidden = new Array(hiddenSize).fill(0);
    let weightsHiddenOutput = new Array(hiddenSize).fill(0).map(() => new Array(outputSize).fill(0));
    let biasesOutput = new Array(outputSize).fill(0);
    for (let i = 0; i < inputSize; i++) {
        for (let j = 0; j < hiddenSize; j++) {
            weightsInputHidden[i][j] = Math.random() - 0.5;
        }
    }
    for (let i = 0; i < hiddenSize; i++) {
        for (let j = 0; j < outputSize; j++) {
            weightsHiddenOutput[i][j] = Math.random() - 0.5;
        }
    }
    for (let i = 0; i < hiddenSize; i++) {
        biasesHidden[i] = Math.random() - 0.5;
    }
    for (let i = 0; i < outputSize; i++) {
        biasesOutput[i] = Math.random() - 0.5;
    }
    function sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }
    function normalize(output) {
        const sum = output.reduce((acc, val) => acc + val, 0);
        return output.map(val => val / sum);
    }
    function neuralNetwork(input) {
        const hiddenLayer = new Array(hiddenSize).fill(0);
        for (let i = 0; i < hiddenSize; i++) {
            for (let j = 0; j < inputSize; j++) {
                hiddenLayer[i] += input[j] * weightsInputHidden[j][i];
            }
            hiddenLayer[i] = sigmoid(hiddenLayer[i] + biasesHidden[i]);
        }
        const output = new Array(outputSize).fill(0);
        for (let i = 0; i < outputSize; i++) {
            for (let j = 0; j < hiddenSize; j++) {
                output[i] += hiddenLayer[j] * weightsHiddenOutput[j][i];
            }
            output[i] = sigmoid(output[i] + biasesOutput[i]);
        }
        return { output: normalize(output), hiddenLayer };
    }
    function calculateTargetPosition(player, exitX, exitY) {
        const targetX = exitX;
        const targetY = exitY;
        return { targetX, targetY };
    }
    const explorationFactor = 100;
    function ucbScore(actionValue, actionCount, totalSteps) {
        const explorationBonus = explorationFactor * Math.sqrt(Math.log(totalSteps + 1) / (actionCount + 1));
        return actionValue + explorationBonus;
    }
    function calculateDesiredOutput(player, exitX, exitY, targetX, targetY) {
        const desiredOutput = new Array(outputSize).fill(0);
        const { output } = neuralNetwork(input);
        const maxOutputIndex = output.indexOf(Math.max(...output));
        desiredOutput[maxOutputIndex] = 1;
        return desiredOutput;
    }
    function calculateLoss(desiredOutput, actualOutput) {
        let loss = 0;
        for (let i = 0; i < desiredOutput.length; i++) {
            loss += Math.pow(desiredOutput[i] - actualOutput[i], 2);
        }
        return loss;
    }    
    function calculateMovementReward(player, output, desiredOutput) {
        let movementReward = 0;
        if (output.up > 0.5 && desiredOutput[0] === 0) {
            movementReward -= 1;
        } else {
            movementReward += 0.1;
        }
        if (output.down > 0.5 && desiredOutput[1] === 0) {
            movementReward += 1;
        } else {
            movementReward -= 0.1;
        }
        if (output.left > 0.5 && desiredOutput[2] === 0) {
            movementReward += 1;
        } else {
            movementReward -= 0.1;
        }
        if (output.right > 0.5 && desiredOutput[3] === 0) {
            movementReward += 1;
        } else {
            movementReward -= 0.1;
        }
        if(Matter.Query.collides(map, playerBody).length > 0) {
            movementReward -= 100;
        } else {
            movementReward += 1;
        }
        if (
            player.position.x > level.exit.x &&
            player.position.x < level.exit.x + 100 &&
            player.position.y > level.exit.y - 150 &&
            player.position.y < level.exit.y - 0 &&
            player.velocity.y < 0.15
        ) {
            movementReward += 100;
        }
        const distanceToExit = Math.sqrt(
            Math.pow(player.position.x - level.exit.x, 2) + 
            Math.pow(player.position.y - level.exit.y, 2)
        );
        movementReward += 1 / distanceToExit;
        return movementReward;
    }

    function calculateHealthReward() {
        const healthReward = m.health * 0.1; 
        return healthReward;
    }
    function updateInputArray(player, exitX, exitY, mobPositions, mapPositions, bodyPositions) {
        const parsedMobPositions = JSON.parse(mobPositions);
        const mobX = parsedMobPositions.map(position => position.x);
        const mobY = parsedMobPositions.map(position => position.y);

        const parsedMapPositions = JSON.parse(mapPositions);
        const mapX = parsedMapPositions.map(position => position.x);
        const mapY = parsedMapPositions.map(position => position.y);

        const parsedBodyPositions = JSON.parse(bodyPositions);
        const bodyX = parsedBodyPositions.map(position => position.x);
        const bodyY = parsedBodyPositions.map(position => position.y);

        const input2 = [
            m.health,
            /* m.angle, */
            player.velocity.x,
            player.velocity.y,
            player.position.x,
            player.position.y,
            exitX - player.position.x,
            exitY - player.position.y,
            ...mobX,
            ...mobY,
            ...mapX,
            ...mapY,
            ...bodyX,
            ...bodyY,
            input
        ];
        
        return input2;
    }    
    const clipParam = 0.2; 
    let learningRate = 1;
    const gradientThreshold = 1;
    function updateWeightsAndBiases(desiredOutput, actualOutput, hiddenLayer, advantage) {
        const outputProbabilities = actualOutput;
        const mobPos = [];
        for (let i = 0; i < mob.length; i++) {
            mobPos.push({ x: mob[i].position.x, y: mob[i].position.y });
        }
        const mapPos = [];
        for (let i = 0; i < map.length; i++) {
            mapPos.push({ x: map[i].position.x, y: map[i].position.y });
        }
        const bodyPos = [];
        for (let i = 0; i < body.length; i++) {
            bodyPos.push({ x: body[i].position.x, y: body[i].position.y });
        }
        const oldOutput = neuralNetwork(
            updateInputArray(
                player,
                level.exit.x,
                level.exit.y,
                JSON.stringify(mobPos),
                JSON.stringify(mapPos),
                JSON.stringify(bodyPos)
            )
        ).output;
        
        const ratios = [];
        for (let i = 0; i < desiredOutput.length; i++) {
            ratios[i] = actualOutput[i] / oldOutput[i];
        }
        
        const surrogateObjectives = [];
        for (let i = 0; i < desiredOutput.length; i++) {
            const minRatio = Math.min(ratios[i], 1 + clipParam);
            const maxRatio = Math.max(ratios[i], 1 - clipParam);
            surrogateObjectives[i] = Math.min(
                ratios[i] * (desiredOutput[i] - oldOutput[i]),
                minRatio * (desiredOutput[i] - oldOutput[i]),
                maxRatio * (desiredOutput[i] - oldOutput[i])
            );
        }
        
        for (let i = 0; i < hiddenSize; i++) {
            for (let j = 0; j < outputSize; j++) {
                const gradient = hiddenLayer[i] * surrogateObjectives[j];
                const ppoClipped = Math.min(gradient, advantage * clipParam);
                const norm = Math.sqrt(weightsHiddenOutput[i][j] ** 2 + ppoClipped ** 2);
                const scale = norm > gradientThreshold ? gradientThreshold / norm : 1;
                
                weightsHiddenOutput[i][j] += learningRate * ppoClipped * scale;
            }
            const gradient = surrogateObjectives[i];
            const norm = Math.abs(biasesOutput[i]) + Math.abs(gradient);
            const scale = norm > gradientThreshold ? gradientThreshold / norm : 1;
            biasesOutput[i] += learningRate * gradient * scale;
        }
        learningRate = Math.max(learningRate * 0.99, 0.001);
    }     
    const movementIndex = 0;
    const explorationReward = 1;
    let epsilon = 0.2; 

    function updateNeuralNetwork(player, exitX, exitY, mobPositions, mapPositions, bodyPositions) {
        const inputt = updateInputArray(player, exitX, exitY, mobPositions, mapPositions, bodyPositions);
        const { output, hiddenLayer } = neuralNetwork(inputt);
        let chosenActionIndex;
        if (Math.random() < epsilon) {
            chosenActionIndex = Math.floor(Math.random() * outputSize);
        } else {
            chosenActionIndex = output.indexOf(Math.max(...output));
        }
        const desiredOutput = new Array(outputSize).fill(0);
        desiredOutput[chosenActionIndex] = 1;
        const movementReward = calculateMovementReward(player, output, desiredOutput);
        const healthReward = calculateHealthReward();
        const loss = calculateLoss(desiredOutput, output);
        const explorationRewardValue = explorationReward * (1 - output[chosenActionIndex]);
        const totalReward = movementReward + healthReward - loss + explorationRewardValue;
        const totalSteps = m.cycle;
        const advantage = totalReward - ucbScore(output[chosenActionIndex], totalSteps, movementIndex);
        updateWeightsAndBiases(desiredOutput, output, hiddenLayer, advantage);
        console.log(totalReward + "," + movementReward + "," + loss + "," + desiredOutput + "," + output);
        input.up = desiredOutput[0] > 0.5;
        input.down = desiredOutput[1] > 0.5;
        input.left = desiredOutput[2] > 0.5;
        input.right = desiredOutput[3] > 0.5;
        input.field = desiredOutput[4] > 0.5;
        input.fire = desiredOutput[5] > 0.5;  
        /* m.angle = output[6] * Math.PI * 2; */
    }
    function saveWeightsAndBiases() {
        const savedData = {
            weightsInputHidden,
            weightsHiddenOutput,
            biasesHidden,
            biasesOutput
        };
        const jsonData = JSON.stringify(savedData);
        
        localStorage.setItem('neuralNetworkData', jsonData);
    }
    function loadWeightsAndBiases() {
        const jsonData = localStorage.getItem('neuralNetworkData');
        if (jsonData) {
            const loadedData = JSON.parse(jsonData);
            weightsInputHidden = loadedData.weightsInputHidden;
            weightsHiddenOutput = loadedData.weightsHiddenOutput;
            biasesHidden = loadedData.biasesHidden;
            biasesOutput = loadedData.biasesOutput;
            console.log("Loaded weights and biases from local storage:", loadedData);
        } else {
            console.log("No saved data found in local storage");
        }
    }
    // loadWeightsAndBiases();
    simulation.ephemera.push({
        name: "ai",
        do() {
            // saveWeightsAndBiases();
            epsilon -= (epsilon > 0.1 ? 0.00001 : 0);
            /* m.look = () => {
                const scale = 0.8;
                m.transSmoothX = canvas.width2 - m.pos.x - (simulation.mouse.x - canvas.width2) * scale;
                m.transSmoothY = canvas.height2 - m.pos.y - (simulation.mouse.y - canvas.height2) * scale;

                m.transX += (m.transSmoothX - m.transX) * 0.07;
                m.transY += (m.transSmoothY - m.transY) * 0.07;
            }; */
            const mobPos = [];
            for(let i = 0; i < mob.length; i++) {
                mobPos.push({x: mob[i].position.x, y: mob[i].position.y})
            }
            const mapPos = [];
            for(let i = 0; i < map.length; i++) {
                mapPos.push({x: map[i].position.x, y: map[i].position.y})
            }
            const bodyPos = [];
            for(let i = 0; i < body.length; i++) {
                bodyPos.push({x: body[i].position.x, y: body[i].position.y})
            }
            const targetPosition = calculateTargetPosition(player, level.exit.x, level.exit.y);
            const desiredOutput = calculateDesiredOutput(
                player,
                level.exit.x,
                level.exit.y,
                targetPosition.targetX,
                targetPosition.targetY
            );
        
            updateNeuralNetwork(
                player,
                level.exit.x,
                level.exit.y,
                JSON.stringify(mobPos),
                JSON.stringify(mapPos),
                JSON.stringify(bodyPos),
                targetPosition.targetX,
                targetPosition.targetY,
                desiredOutput,
                input
            );
        },
    });
})();