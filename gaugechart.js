const arrayToObject = function (arrayOfObjects) {
    var keys = d3.keys(arrayOfObjects[0]),
        objectOfArrays = {};

    keys.forEach(function (key) {
        objectOfArrays[key] = [];
    });

    arrayOfObjects.forEach(function (obj) {
        keys.forEach(function (key) {
            objectOfArrays[key].push(obj[key]);
        });
    });

    return objectOfArrays;
};

const percentToRadian = d3.scaleLinear() 
                            .domain([0, 100])
                            .range([0, Math.PI]);

const drawGaugeChart = function (selector, width, score, slabData, isAnimated) {
    var padPercent = 1.0,
        scoreSnapPercent = 2.5,
        scoreDecimalPrecision = 1,

        chartClassName = "meter-gauge",
        pointerClassName = "pointer",
        scoreLimitClassName = "scorelimit",
        scoreDisplayClassName = "scoredisplay",
        assessmentClassName = "assessment",

        slabMinKey = "slabMin",
        slabMaxKey = "slabMax",
        colorKey = "color",
        assessmentKey = "assessment",

        delay = 200,
        duration = 1500,
        ease = d3.easeCubic,

        height = width / (2 * 0.8),
        arcInnerRadius = width * 0.4,
        arcWidth = arcInnerRadius * 0.06,
        baseFontSize = (width * 0.02).toFixed(1) + "px";
    
    slabData.sort((row1, row2) => d3.ascending(row1[slabMinKey], row2[slabMinKey])); // sorts rows based on slabMin property 
    
    var minScore = d3.min(slabData, d => d[slabMinKey]),
        maxScore = d3.max(slabData, d => d[slabMaxKey]);
    
    const scoreToRadian = d3.scaleLinear() 
                            .domain([minScore, maxScore])
                            .range([-Math.PI / 2, Math.PI / 2]);

    const scoreToDegreesDelta = d3.scaleLinear()
                                    .domain([minScore, maxScore])
                                    .range([0, 180]);

    const percentToScoreDelta = d3.scaleLinear()
                                    .domain([0, 100])
                                    .range([0, maxScore - minScore]);

    const percentToDegreeDelta = d3.scaleLinear()
                                    .domain([0, 100])
                                    .range([0, 180]);
    
    var columnData = arrayToObject(slabData),
        thresholds = columnData[slabMinKey].map(item => item); // creates a slabMin array clone
    
    thresholds.shift(); // drops the first item in thresholds array
    
    const getSlabProperty = function (score, property) {
    // gets a specific property for the corresponding slab for a given score
        var dataGetters = {};
    
        d3.keys(columnData).forEach(function (key) {
            dataGetters[key] = d3.scaleThreshold()
                                    .domain(thresholds)
                                    .range(columnData[key]);
        });
        
        return dataGetters[property](score);
    };

    // Chart drawing starts here...
    var g = d3.select(selector)
                .attr("width", width) 
                .attr("height", height)
                .attr("class", chartClassName)
                .attr("font-size", baseFontSize)
                .append("g")
                .attr("transform", "translate(" + width / 2 + "," + height * 4 / 5 + ")");
    
    // Slab arcs
    slabData.forEach(function (d) {
        var arc = d3.arc()
                    .innerRadius(arcInnerRadius)
                    .outerRadius(arcInnerRadius - arcWidth)
                    .startAngle(scoreToRadian(d.slabMin))
                    .endAngle(scoreToRadian(d.slabMax))
                    .padAngle(percentToRadian(padPercent))
                    .cornerRadius(arcWidth);
        
        g.append("path")
            .attr("class", "slab-arc")
            .attr("fill", d.color)
            .attr("d", arc); 
    });

    // Score limit labels
    scoreLimits = [
        {
            label: minScore,
            xLocation: -arcInnerRadius + arcWidth / 2
        },
        {
            label: maxScore,
            xLocation: arcInnerRadius - arcWidth / 2            
        }
    ]

    scoreLimits.forEach(function (l) {
        g.append("text")
        .attr("class", scoreLimitClassName)
        .attr("x", l.xLocation)
        .attr("text-anchor", "middle")
        .attr("dy", arcWidth * 2)
        .text(l.label);
    });

    // Circle-shaped pointer
    const rotatePointerWithSnapping = function(score) {
    // used for getting the location of the circle-shaped pointer in the chart given the score value
        var scoreSnapBoundaryExact = percentToScoreDelta(scoreSnapPercent),
            scoreSnapInboundExact = percentToScoreDelta(scoreSnapPercent + 1),
            slabMin = getSlabProperty(score, slabMinKey),
            slabMax = getSlabProperty(score, slabMaxKey),
            slabMinSnap = slabMin + scoreSnapBoundaryExact,
            slabMinInboundSnap = slabMin + scoreSnapInboundExact,
            slabMaxSnap = slabMax - scoreSnapBoundaryExact,
            slabMaxInboundSnap = slabMax - scoreSnapInboundExact;
        
        if (slabMinInboundSnap >= slabMaxInboundSnap) {
            score = (slabMin + slabMax) / 2; // condition for pointer when slab arc is
                                                // too small for snapping
        } else if (score < slabMinInboundSnap) {
            score = score <= slabMin ? slabMinSnap : slabMinInboundSnap; // condition for pointer snapping
                                                                            // to slab minimum or a bit inside
        } else if (score > slabMaxInboundSnap) {
            score = score >= slabMax ? slabMaxSnap : slabMaxInboundSnap; // condition for pointer snapping
                                                                            // to slab maximum or a bit inside
        } else {
            // pass
        }

        return scoreToDegreesDelta(score);
    }

    var pointerInitialRotation = percentToDegreeDelta(scoreSnapPercent),
        pointerInitialTranslation = "translate(" + (-arcInnerRadius + arcWidth / 2) + ", 0)",
        pointerInitialTransform = "rotate(" + pointerInitialRotation + ") " + pointerInitialTranslation,
        pointerFinalRotation = rotatePointerWithSnapping(score),
        pointerFinalTransform = "rotate(" + pointerFinalRotation + ") " + pointerInitialTranslation;

    var pointerArc = d3.arc()
                        .innerRadius(0)
                        .outerRadius(arcWidth * 0.8)
                        .startAngle(0)
                        .endAngle(8);

    var pointer = g.append("path")
        .attr("class", pointerClassName)
        .attr("stroke-width", arcWidth / 1.5)
        .attr("d", pointerArc)
    
    if (isAnimated) {
        pointer.attr("transform", pointerInitialTransform)
            .attr("stroke", getSlabProperty(minScore, colorKey));

        pointer.transition("move")
            .ease(ease)
            .delay(delay)
            .duration(duration)
            .attrTween("transform", function () {
                return d3.interpolateString(pointerInitialTransform, pointerFinalTransform);
            });

        pointer.transition("changeColor")
            .ease(ease)
            .delay(delay)
            .duration(duration)
            .attrTween("stroke", function () {
                var t = d3.interpolateNumber(minScore, score);
    
                return function (i) {
                    var strokeColor = getSlabProperty(t(i), colorKey);
                    return strokeColor;
                }
            });
    } else {
        pointer.attr("transform", pointerFinalTransform)
            .attr("stroke", getSlabProperty(score, colorKey));
    }

    // Score display
    const getScoreDisplayText = function (score) {
    // Score display text
        var precisionFactor = Math.pow(10, scoreDecimalPrecision),
            scoreDisplay = score.toFixed(1) === getSlabProperty(score, slabMaxKey).toFixed(1)
                            ? (Math.floor(score * precisionFactor) / precisionFactor).toFixed(scoreDecimalPrecision)
                            : score.toFixed(scoreDecimalPrecision);
        
        return scoreDisplay;
    };

    var scoreDisplayElement = g.append("text")
        .attr("class", scoreDisplayClassName)
        .attr("text-anchor", "middle")
        .attr("dy", - arcWidth * 4);

    if (isAnimated) {
        scoreDisplayElement.text(getScoreDisplayText(minScore))
            .transition()
            .ease(ease)
            .delay(delay)
            .duration(duration)
            .tween("text", function () {
                var node = this;
                var precisionFactor = Math.pow(10, scoreDecimalPrecision);
                var startPoint = +node.textContent * precisionFactor;

                var t = d3.interpolateRound(
                    startPoint * precisionFactor,
                    +getScoreDisplayText(score) * precisionFactor
                )

                return function (i) {
                    var textContent = (t(i) / precisionFactor).toFixed(1);
                    node.textContent = textContent;
                };
            });
    } else {
        scoreDisplayElement.text(getScoreDisplayText(score));
    }    
    
    // Assessment display
    var assessmentDisplayElement = g.append("text")
        .attr("class", assessmentClassName)
        .attr("text-anchor", "middle")
        .attr("dy", arcWidth * 0.1)
    
    if (isAnimated) {
        assessmentDisplayElement.text(getSlabProperty(minScore, assessmentKey))
            .transition()
            .delay(delay)
            .duration(duration)
            .ease(ease)
            .tween("text", function () {
                var node = this,
                    t = d3.interpolateNumber(minScore, score);

                return function (i) {
                    var textContent = getSlabProperty(t(i), assessmentKey);
                    node.textContent = textContent;
                };
            });
    } else {
        assessmentDisplayElement.text(getSlabProperty(score, assessmentKey));
    }
}
