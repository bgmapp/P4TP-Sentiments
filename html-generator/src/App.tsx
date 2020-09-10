import React, { RefObject } from 'react';
import { SketchPicker } from 'react-color';
import Form from 'react-bootstrap/Form';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import ListGroup from 'react-bootstrap/ListGroup';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

var template = require('./Template.js');
var copyableHtmlText: RefObject<HTMLTextAreaElement>
copyableHtmlText = React.createRef()

var defaultBoundaryPopupContent = JSON.stringify([{
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
}])

function App() {
  configChanged(null)

  return (
    <Row className="App">
      <Col id="copyableHtmlConfigDiv" sm="6">
        <Form>
          <ListGroup>
            <ListGroup.Item>
              <h3>Web Map Configuration</h3>

              <Form.Group as={Row} controlId="webMapId">
                <Form.Label column sm="4">Web Map Id</Form.Label>
                <Col sm="8">
                  <Form.Control 
                    type="text" 
                    placeholder="820b892cf2b54283bcef1c1c9c635524"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>
            </ListGroup.Item>

            <ListGroup.Item>
              <h3>Survey Layer Configuration</h3>

              <Form.Group as={Row} controlId="surveyLayerName">
                <Form.Label column sm="4">Survey Layer Name</Form.Label>
                <Col sm="8">
                  <Form.Control 
                    type="text"
                    placeholder="Race Relations Word Cloud Survey - 2"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} controlId="surveyQuestionField">
                <Form.Label column sm="4">Survey Question Field</Form.Label>
                <Col sm="8">
                  <Form.Control 
                    type="text"
                    placeholder="Question"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} controlId="surveyDescriptionField">
                <Form.Label column sm="4">Survey Description Field</Form.Label>
                <Col sm="8">
                  <Form.Control 
                    type="text"
                    placeholder="describe_why_you_chose_this_wor"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>
            </ListGroup.Item>
          
            <ListGroup.Item>
              <h3>Boundary Layer Configuration</h3>

              <Form.Group as={Row} controlId="boundaryLayerName">
                <Form.Label column sm="4">Boundary Layer Name</Form.Label>
                <Col sm="8">
                  <Form.Control
                    type="text"
                    placeholder="USA States (Generalized)"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} controlId="boundaryNameField">
                <Form.Label column sm="4">Boundary Name Field</Form.Label>
                <Col sm="8">
                  <Form.Control 
                    type="text" 
                    placeholder="STATE_NAME"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>
            
              <Form.Group as={Row} controlId="extraBoundaryPopupContent">
                <Form.Label column sm="4">Extra Boundary Popup Content</Form.Label>
                <Col sm="8">
                  <Form.Control
                    as="textarea"
                    placeholder={defaultBoundaryPopupContent}
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>
            </ListGroup.Item>

            <ListGroup.Item>
              <h3>Word Cloud Configuration</h3>

              <Form.Group as={Row} controlId="wordCloudColor">
                <Form.Label column sm="4">Word Cloud Color</Form.Label>
                <Col sm="8">
                  <SketchPicker
                    color={ '#ebb134' }
                    onChangeComplete={ configChanged }
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} controlId="wordCloudSelectedColor">
                <Form.Label column sm="4">Word Cloud Selected Color</Form.Label>
                <Col sm="8">
                  <SketchPicker
                    color={ '#eb5634' }
                    onChangeComplete={ configChanged }
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} controlId="wordCloudFontFamily">
                <Form.Label column sm="4">Word Cloud Font Family</Form.Label>
                <Col sm="8">
                  <Form.Control
                    type="text"
                    placeholder="Futura"
                    onChange={ configChanged }
                  />
                </Col>
              </Form.Group>
            </ListGroup.Item>
          </ListGroup>
        </Form>
      </Col>

      <Col id="copyableHtmlDiv" sm="6">
        <Form.Group controlId="copyableHtml">
          <Form.Label column sm="4">Copyable HTML</Form.Label>
          <Col sm="12">
            <Form.Control
              as="textarea"
              placeholder={template.html}
              ref={copyableHtmlText}
            />
          </Col>
        </Form.Group>
        
      </Col>
    </Row>
  );
}

function configChanged(evt: any) {
  if (!evt) {
    setTimeout(() => {
      copyableHtmlText.current!.value = template.replace()
    }, 500)
  } else {
    if (evt.target.id === 'extraBoundaryPopupContent') {
      copyableHtmlText.current!.value = template.replace(evt.target.id, JSON.stringify(evt.target.value))
    } else {
      copyableHtmlText.current!.value = template.replace(evt.target.id, `"${evt.target.value}"`)
    }
  }
}

export default App;