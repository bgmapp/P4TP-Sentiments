export let html = `<!DOCTYPE html>
<meta charset="utf-8">

<!-- Load d3.js -->
<script src="https://d3js.org/d3.v4.js"></script>

<!-- Load d3-cloud -->
<script src="https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/LIB/d3.layout.cloud.js"></script>

<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script>

<!-- Load arcgis js api -->
<link
  rel="stylesheet"
  href="https://js.arcgis.com/4.16/esri/themes/light/main.css"
/>
<script src="https://js.arcgis.com/4.16/"></script>

<style>
  html,
  body,
  #wordCloudContainer {
    width: 100%;
    height: 100%;
    display: inline-block;
    background-color: rgb(34, 34, 34);
    overflow: hidden;
  }

  #wordCloudDiv {
    height: 100%;
    width: 30%;
    float: left;
  }

  #wordCloudItem {
    width: 100%;
    height: calc(100% - 50px);
  }

  #wordCloudItem svg g g text:hover {
    fill: rgb(3, 252, 252) !important
  }
  
  #wordCloudMapDiv {
    height: 100%;
    width: 70%;
    float: right;
  }

  @media only screen and (max-width: 1000px) {
    #wordCloudContainer {
      display: block;
    }

    #wordCloudDiv {
      width: 100%;
      float: none;
      height: 250px;
    }

    #wordCloudItem {
      width: 100%;
      height: 200px;
    }

    #wordCloudMapDiv {
      width: 100%;
      height: calc(100% - 260px);
      float: none;
    }
  }

  @media only screen and (max-height: 750px) and (max-width: 1000px) {
    #wordCloudDiv {
      height: 150px;
    }

    #wordCloudItem {
      height: 100px;
    }

    #wordCloudMapDiv {
      height: calc(100% - 160px);
    }
  }

  #wordCloudLabel {
    width: calc(100% - 20px);
    height: 40px;
    margin: 10px;
    font-family: "Avenir Next", "Helvetica Neue", sans-serif;
    font-weight: bolder;
    font-style: unset;
    font-size: 20px;
    color: white;
    text-align: center;
  }

  .esri-editor .esri-item-list__scroller {
    max-height: 350px;
  }
</style>

<!-- Create a div where the graph will take place -->
<div id="wordCloudContainer">
  <div id="wordCloudDiv">
    <div id="wordCloudLabel">Click a word to filter the map and see more info!</div>
    <div id="wordCloudItem"></div>
  </div>
  <div id="wordCloudMapDiv"></div>
</div>

<script>
  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/geometry/Multipoint",
    "esri/core/watchUtils",
    "esri/widgets/Home"
  ], function (WebMap, MapView, Multipoint, EsriWatchUtils, Home) {
    // TO BE REPLACED FOR CONFIGURATION
    // -----------------------------------------------------------------
    @@@REPLACEME@@@
    // -----------------------------------------------------------------
    // TO BE REPLACED FOR CONFIGURATION

    var maxHeight = 750;
    var maxWidth = 1000;

    var popupHasOpenedOnce = false;

    var debouncing = false;
    var allQuestionAnswers = [];
    var lastQuestionAnswers = [];
    var layout = null;
    var surveyLayer = null;
    var statesLayer = null;
    var defaultPopupTemplate = null;

    var currentAnswer = null;
    var currentStates = [];

    var wordLocations = {};
    var wordDupes = {};

    var closingPopup = false;

    var margin = {top: 10, right: 10, bottom: 10, left: 10}
    width = ($(window).width()*(0.3)) - margin.left - margin.right,
    height = ($(window).height()-50) - margin.top - margin.bottom;

    var svg = null;
    var waitingOnRefresh = false;

    var originalSurveyLayerDefExpr = "1=1";
    var originalStatesLayerDefExpr = "1=1";
    
    // Create a map from the referenced webmap item id
    let webmap = new WebMap({
      portalItem: {
        id: webMapId
      }
    });

    let view = new MapView({
      container: "wordCloudMapDiv",
      map: webmap,
      popup: {
        dockEnabled: true,
        dockOptions: {
          buttonEnabled: true,
          breakpoint: false
        }
      }
    });

    view.when(() => {
      const surveyLayer = getSurveyLayer()
      const statesLayer = getStatesLayer()
      originalSurveyLayerDefExpr = surveyLayer.definitionExpression
      originalStatesLayerDefExpr = statesLayer.definitionExpression

      let home = new Home({
        view: view
      })

      view.ui.add(home, {
        position: "top-left"
      })

      // reduceFeatures()
      EsriWatchUtils.whenTrue(view, 'stationary', () => {
        if (view.extent) {
          extentChanged()
        }
      });

      EsriWatchUtils.watch(view.popup, 'visible', popupVisibleChanged)
      EsriWatchUtils.watch(view.popup, 'selectedFeature', popupFeatureChanged)
      $(window).on('resize', resetWordCloud)

      defaultPopupTemplate = getStatesLayer().popupTemplate
      
      setupSurveyLayerViewEvent()
      filterBadWords()
    })

function setupWordCloud() {
  if (!svg) {
    if ($(window).width() <= maxWidth) {
      width = $(window).width() - margin.left - margin.right

      if ($(window).height() <= maxHeight) {
        height = 100 - margin.top - margin.bottom
      } else {
        height = 200 - margin.top - margin.bottom
      }
    }

    // append the svg object to the body of the page
    svg = d3.select("#wordCloudItem").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    extentChanged()
  } else {
    resetWordCloud()
  }

  waitingOnRefresh = false;
}

function setupSurveyLayerViewEvent() {
  view.whenLayerView(getSurveyLayer()).then(function(layerView){
    layerView.watch("updating", function(value){
      if (!value) {
        console.log('am i waiting on refresh? ' + waitingOnRefresh)
        if (waitingOnRefresh) setupWordCloud()
        else filterBadWords()
      }
    });
  });
}

function filterBadWords() {
  surveyLayer = getSurveyLayer()
  let newQuestionAnswers = false;

  const surveyQuery = surveyLayer.createQuery();
  surveyLayer.queryFeatures(surveyQuery).then((surveyResults) => {
    let badQuestions = []
    surveyResults.features.forEach(feature => {
      const question = feature.attributes[surveyQuestionField]
      if (!allQuestionAnswers.includes(question)) {
        allQuestionAnswers.push(question)
        newQuestionAnswers = true;
      }
      
      if (fetchBadWords().includes(question.toLowerCase()) || fetchDummyWords().includes(question.toLowerCase())) {
        badQuestions.push('\'' + question + '\'')
      } else {
        const description = feature.attributes[surveyDescriptionField]
        if (description) {
          const descriptionWords = description.split(/[\s,]+/)
          for (i = 0; i < descriptionWords.length; i++) {
            const word = descriptionWords[i]
            if (fetchBadWords().includes(word.toLowerCase())) {
              badQuestions.push('\'' + question + '\'')
              break
            }
          }
        }
      }
    })

    if (newQuestionAnswers) {
      if (badQuestions.length > 0) {
        waitingOnRefresh = true
        surveyLayer.definitionExpression = '(' + originalSurveyLayerDefExpr + ') AND (' + surveyQuestionField + ' NOT IN (' + badQuestions.join(',') + '))'
      } else {
        setupWordCloud()
      }
    }
  });
}

function reduceFeatures() {
  const surveyLayer = getSurveyLayer()
  surveyLayer.featureReduction = {
    type: "cluster",
    clusterRadius: "100px",
    popupTemplate: {
      content: "This cluster represents {cluster_count} answers."
    },
    clusterMinSize: "24px",
    clusterMaxSize: "60px",
    labelingInfo: [{
      // turn off deconfliction to ensure all clusters are labeled
      deconflictionStrategy: "none",
      labelExpressionInfo: {
        expression: "Text($feature.cluster_count, '#,###')"
      },
      symbol: {
        type: "text",
        color: "#004a5d",
        font: {
          weight: "bold",
          family: "Noto Sans",
          size: "12px"
        }
      },
      labelPlacement: "center-center",
    }]
  }
}

function resetWordCloud(evt) {
  if (evt) {
    allQuestionAnswers = []
    filterBadWords()
  } else if (svg) {
    svg = d3.select("#wordCloudItem").select('svg').remove()

    if ($(window).width() > maxWidth) {
      width = ($(window).width()*(0.3)) - margin.left - margin.right
      height = ($(window).height()-50) - margin.top - margin.bottom
    } else {
      width = $(window).width() - margin.left - margin.right

      if ($(window).height() <= maxHeight) {
        height = 100 - margin.top - margin.bottom
      } else {
        height = 200 - margin.top - margin.bottom
      }
    }

    svg = d3.select("#wordCloudItem").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    refreshWordCloud(lastQuestionAnswers)
  }
}

function getSurveyLayer() {
  if (!surveyLayer) {
    view.map.layers.forEach(layer => {
      if (layer.title === surveyLayerName) {
        surveyLayer = layer;
      }
    });
  }

  return surveyLayer
}

function getStatesLayer() {
  if (!statesLayer) {
    view.map.layers.forEach(layer => {
      if (layer.title === statesLayerName) {
        statesLayer = layer;
      }
    });
  }

  return statesLayer
}
    
function extentChanged(evt) {
  if (!debouncing) {
    debouncing = true;
    setTimeout(() => {
      debouncing = false;
    }, 100);

    const surveyLayer = getSurveyLayer()
    const surveyQuery = surveyLayer.createQuery();
    surveyQuery.geometry = view.extent;

    surveyLayer.queryFeatures(surveyQuery).then((results) => {
      const questionAnswers = results.features.map((feature) => {
        const questionAnswer = feature.attributes[surveyQuestionField]
        const lowerCaseQuestionAnswer = questionAnswer.toLowerCase()
        if (wordDupes.hasOwnProperty(lowerCaseQuestionAnswer) && 
            !wordDupes[lowerCaseQuestionAnswer].includes(questionAnswer)) {
          wordDupes[lowerCaseQuestionAnswer].push('\'' + questionAnswer + '\'')
        } else {
          wordDupes[lowerCaseQuestionAnswer] = ['\'' + questionAnswer + '\'']
        }
        
        return lowerCaseQuestionAnswer;
      });

      const uniqueQuestionAnswers = [...new Set(questionAnswers)]

      if (!arraysEqual(uniqueQuestionAnswers, lastQuestionAnswers)) {
        refreshWordCloud(uniqueQuestionAnswers);
      }
    });
  }
}
    
function refreshWordCloud(questionAnswers) {
  if (svg) {
    const fontSize = ($(window).height() <= maxHeight && $(window).width() <= maxWidth) ? 20 : 30
    layout = d3.layout.cloud()
      .size([width, height])
      .words(questionAnswers.map(function(d) { return {text: d}; }))
      .padding(5)    
      .rotate(0)    //space between words
      .fontSize(fontSize)      // font size of words
      .on("end", draw);
    layout.start(); 
    
    lastQuestionAnswers = questionAnswers;
  }
}

function clickedWord(evt) {
  currentStates = [];

  closePopup()

  if (currentAnswer && currentAnswer === evt.text) {
    currentAnswer = null
  } else {
    currentAnswer = evt.text
  }

  refreshWordCloud(lastQuestionAnswers)
  
  const surveyLayer = getSurveyLayer()
  const statesLayer = getStatesLayer()

  statesLayer.definitionExpression = originalStatesLayerDefExpr

  if (currentAnswer) {
    const surveyQuery = surveyLayer.createQuery();
    const statesQuery = statesLayer.createQuery();
    surveyQuery.where = surveyQuestionField + ' IN (' + wordDupes[currentAnswer].join(',') + ')';

    const multiPointResults = new Multipoint()
    surveyLayer.queryFeatures(surveyQuery).then((results) => {
      results.features.forEach((feature) => {
        multiPointResults.addPoint(feature.geometry)
      });

      statesQuery.geometry = multiPointResults
      statesLayer.queryFeatures(statesQuery).then((statesResults) => {
        currentStates = statesResults.features
        filterStates()
        openCurrentStatesPopup()
      });
    });
  }
}

function filterStates() {
  const statesLayer = getStatesLayer()
  let defExpr = null
  currentStates.forEach((feature) => {
    if (!defExpr) defExpr = ''
    else defExpr += ' OR '
    defExpr += (stateNameField + ' = \'' + feature.attributes[stateNameField] + '\'')
  })
  statesLayer.definitionExpression = '(' + originalStatesLayerDefExpr + ') AND (' + defExpr + ')'
}

function closePopup() {
  if (view.popup.visible) {
    closingPopup = true;
    view.popup.close()
  }
}

function openCurrentStatesPopup() {
  view.popup.open({
    features: currentStates,
    updateLocationEnabled: true
  })
}

function popupVisibleChanged(visible) {
  if (!closingPopup && popupHasOpenedOnce && !visible) {
    clickedWord({text: currentAnswer})
  } else {
    closingPopup = false
    popupHasOpenedOnce = true
  }
}

function popupFeatureChanged(feature) {
  const statesLayer = getStatesLayer()
  if (feature && feature.layer && feature.layer === statesLayer) {
    const surveyLayer = getSurveyLayer()
    const surveyQuery = surveyLayer.createQuery();
    surveyQuery.where = surveyQuestionField + ' IN (' + wordDupes[currentAnswer].join(',') + ')';
    surveyQuery.geometry = feature.geometry

    surveyLayer.queryFeatures(surveyQuery).then((results) => {
      const questionDescriptions = results.features.map((feature) => {
        return feature.attributes[surveyDescriptionField]
      });

      setStatesPopup(questionDescriptions, feature)
    });
  }
}

function setStatesPopup(questionDescriptions, state) {
  const statesLayer = getStatesLayer()
  if (currentAnswer) {
    let htmlContent = '<ul class="list-group" id="wordCloudModalBodyList">'
    questionDescriptions.forEach((questionDescription) => {
      htmlContent += '<li class ="list-group-item">' + questionDescription + '</li>'
    });
    htmlContent += '</ul>'
    const titleModifier = questionDescriptions.length > 0 ? 'feels' : 'does not feel'
    statesLayer.popupTemplate = {
      title: '{' + stateNameField + '} ' + titleModifier + ' ' + currentAnswer,
      content: [
        {
          type: "text",
          text: htmlContent
        },
        ...extraStatePopupContent
      ]
    }
  } else {
    statesLayer.popupTemplate = defaultPopupTemplate
  }
}

// This function takes the output of 'layout' above and draw the words
// Wordcloud features that are THE SAME from one word to the other can be here
function draw(words) {
  resetPositions = false
  for(i = 0; i < words.length; i++) {
    if (!wordLocations.hasOwnProperty(words[i].text)) {
      wordLocations = {}
      break
    }
  }

  const fontSize = ($(window).height() <= maxHeight && $(window).width() <= maxWidth) ? 20 : 30
  svg
    .select("g")
    .remove()
  
  svg
    .append("g")
      .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")")
      .selectAll("text")
        .data(words)
      .enter().append("text")
        .style("font-size", fontSize)
        .style("fill", function (d) { if (d.text === currentAnswer) { return wordCloudSelectedColor } else { return wordCloudColor }})
        .style("cursor", "pointer")
        .attr("text-anchor", "middle")
        .style("font-family", fontFamily)
        .attr("transform", function(d) {
          if (!wordLocations.hasOwnProperty(d.text)) {
            wordLocations[d.text] = [d.x, d.y]
          }

          return "translate(" + wordLocations[d.text] + ")rotate(" + d.rotate + ")";
        })
        .text(function(d) { return d.text; }).on("click", clickedWord);
}
    
function arraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || ! Array.isArray(arr2) || arr1.length !== arr2.length) {
      return false;
    }

    const sortedArr1 = arr1.concat().sort();
    const sortedArr2 = arr2.concat().sort();

    for (let i = 0; i < sortedArr1.length; i++) {
      if (sortedArr1[i] !== sortedArr2[i]) {
        return false;
      }
    }

    return true;
}

function fetchBadWords() {
  return ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"]
}

function fetchDummyWords() {
  return ["a", "the", "and", "of"]
}
    
});
  
</script>`

var idMapping = {
  'webMapId': '"820b892cf2b54283bcef1c1c9c635524"',
  'surveyLayerName': '"Race Relations Word Cloud Survey - 2"',
  'surveyQuestionField': '"Question"',
  'surveyDescriptionField': '"describe_why_you_chose_this_wor"',
  'boundaryLayerName': '"USA States (Generalized)"',
  'boundaryNameField': '"STATE_NAME"',
  'extraBoundaryPopupContent': JSON.stringify([{
    type: "media",
    mediaInfos: [
      {
        title: "Race Distribution",
        type: "pie-chart",
        caption: "",
        value: {
          fields: ["WHITE", "BLACK", "AMERI_ES", "ASIAN", "HAWN_PI", "HISPANIC", "OTHER", "MULT_RACE"],
          normalizeField: null,
          tooltipField: null
        }
      }
    ]
  }]),
  'wordCloudColor': '"#ebb134"',
  'wordCloudSelectedColor': '"#eb5634"',
  'wordCloudFontFamily': '"Futura"'
}

export function replace(varToReplace, valueToReplace) {
  var replacedHtml = ''

  if (varToReplace && valueToReplace) {
    idMapping[varToReplace] = valueToReplace
  }
  
  Object.keys(idMapping).forEach(vtr => {
    replacedHtml += `var ${vtr} = ${idMapping[vtr]};`
  })
  
  return html.replace('@@@REPLACEME@@@', replacedHtml)
}