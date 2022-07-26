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

const drawGaugeChart = function (selector, width, score, slabData) {
    var padPercent = 1.0,
        scoreSnapPercent = 2.5,
        scoreDecimalPrecision = 1,
        bgColor = '#FFF',
        textColor = '#000',

        chartClass = 'meter-gauge',
        pointerClass = 'pointer',
        scoreLimitClass = 'scorelimit',
        scoreDisplayClass = 'scoredisplay',
        assessmentClass = 'assessment',

        height = width / (2 * 0.8),
        arcInnerRadius = width * 0.4,
        arcWidth = arcInnerRadius * 0.06,
        baseFontSize = (width * 0.02).toFixed(1) + "px";
    
    slabData.sort((row1, row2) => d3.ascending(row1.slabMin, row2.slabMin)); // sorts rows based on slabMin property 
    
    var minScore = d3.min(slabData, d => d.slabMin),
        maxScore = d3.max(slabData, d => d.slabMax);
    
    const scoreToRadian = d3.scaleLinear() 
                            .domain([minScore, maxScore])
                            .range([0, Math.PI]);
                        
    const percentToScoreDelta = d3.scaleLinear()
                                    .domain([0, 100])
                                    .range([0, maxScore - minScore]);
    
    var columnData = arrayToObject(slabData),
        thresholds = columnData['slabMin'].map(item => item); // creates a slabMin array clone thresholds array
    
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
    
    const translatePointerLocation = function(score) {
    // used for getting the location of the circle-shaped pointer in the chart given the score value
        var scoreSnapBoundaryExact = percentToScoreDelta(scoreSnapPercent),
            scoreSnapInboundExact = percentToScoreDelta(scoreSnapPercent + 1),
            slabMin = getSlabProperty(score, 'slabMin'),
            slabMax = getSlabProperty(score, 'slabMax'),
            slabMinSnap = slabMin + scoreSnapBoundaryExact,
            slabMinInboundSnap = slabMin + scoreSnapInboundExact,
            slabMaxSnap = slabMax - scoreSnapBoundaryExact,
            slabMaxInboundSnap = slabMax - scoreSnapInboundExact;
        
        // condition for pointer snapping to slab minimum or a bit inside
        if (score < slabMinInboundSnap) {
            score = score <= slabMin ? slabMinSnap : slabMinInboundSnap;
        }
        
        // condition for pointer snapping to slab maximum or a bit inside
        if (score > slabMaxInboundSnap) {
            score = score >= slabMax ? slabMaxSnap : slabMaxInboundSnap;
        }

        // condition for pointer when slab arc is to small for snapping
        if (slabMinInboundSnap >= slabMaxInboundSnap) {
            score = (slabMin + slabMax) / 2;
        }

        var x = (arcInnerRadius - arcWidth / 2) * Math.cos(scoreToRadian(score) - Math.PI),
            y = (arcInnerRadius - arcWidth / 2) * Math.sin(scoreToRadian(score) - Math.PI);
        
        return 'translate(' + x + ',' + y + ')';
    }

    var g = d3.select(selector)
                .attr('width', width) 
                .attr('height', height)
                .attr('class', chartClass)
                .attr('font-size', baseFontSize)
                .style('background-color', bgColor)
                .append('g')
                .attr('transform', 'translate(' + width / 2 + ',' + height * 4 / 5 + ')');
    
    // Slab arcs
    slabData.forEach(function (d) {
        var arc = d3.arc()
                    .innerRadius(arcInnerRadius)
                    .outerRadius(arcInnerRadius - arcWidth)
                    .startAngle(scoreToRadian(d.slabMin) - Math.PI / 2)
                    .endAngle(scoreToRadian(d.slabMax) - Math.PI / 2)
                    .padAngle(percentToRadian(padPercent))
                    .cornerRadius(arcWidth);
        
        g.append('path')
            .attr('class', 'slab-arc')
            .attr('fill', d.color)
            .attr('d', arc); 
    });

    // Circle-shaped pointer
    var pointerArc = d3.arc()
                        .innerRadius(0)
                        .outerRadius(arcWidth * 0.8)
                        .startAngle(0)
                        .endAngle(8);
    
    g.append('path')
        .attr('class', pointerClass)
        .attr('transform', translatePointerLocation(score))
        .attr('fill', bgColor)
        .attr('stroke', getSlabProperty(score, 'color'))
        .attr('stroke-width', arcWidth / 1.5)
        .attr('d', pointerArc);

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
        g.append('text')
        .attr('class', scoreLimitClass)
        .attr('x', l.xLocation)
        .attr('text-anchor', 'middle')
        .attr('dy', arcWidth * 2)
        .style('fill', textColor)
        .text(l.label);
    });
    
    // Score display
    var precisionFactor = Math.pow(10, scoreDecimalPrecision);
    var scoreDisplay = score.toFixed(1) === getSlabProperty(score, 'slabMax').toFixed(1)
                        ? (Math.floor(score * precisionFactor) / precisionFactor).toFixed(scoreDecimalPrecision)
                        : score.toFixed(scoreDecimalPrecision);

    g.append('text')
        .attr('class', scoreDisplayClass)
        .attr('text-anchor', 'middle')
        .attr('dy', - arcWidth * 4)
        .style('fill', textColor)
        .text(scoreDisplay);
    
    // Assessment display
    g.append('text')
        .attr('class', assessmentClass)
        .attr('text-anchor', 'middle')
        .attr('dy', arcWidth * 0.1)
        .style('fill', textColor)
        .text(getSlabProperty(score, 'assessment'));
}
