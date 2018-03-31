/**
 * The reflection card presentational component.
 *
 * @flow
 */
// $FlowFixMe
import {convertFromRaw, convertToRaw, EditorState} from 'draft-js';
import React, {Component} from 'react';
import styled, {css} from 'react-emotion';
import ReflectionCardWrapper from 'universal/components/ReflectionCardWrapper/ReflectionCardWrapper';
import editorDecorators from 'universal/components/TaskEditor/decorators';
import appTheme from 'universal/styles/theme/appTheme';

import ReflectionCardDeleteButton from './ReflectionCardDeleteButton';
import {createFragmentContainer} from 'react-relay';
import UpdateReflectionContentMutation from 'universal/mutations/UpdateReflectionContentMutation';
import type {MutationProps} from 'universal/utils/relay/withMutationProps';
import withMutationProps from 'universal/utils/relay/withMutationProps';
import RemoveReflectionMutation from 'universal/mutations/RemoveReflectionMutation';
import EditReflectionMutation from 'universal/mutations/EditReflectionMutation';
import type {ReflectionCard_meeting as Meeting} from './__generated__/ReflectionCard_meeting.graphql';
import type {ReflectionCard_reflection as Reflection} from './__generated__/ReflectionCard_reflection.graphql';
import withAtmosphere from 'universal/decorators/withAtmosphere/withAtmosphere';
import reactLifecyclesCompat from 'react-lifecycles-compat';
import ReflectionEditorWrapper from 'universal/components/ReflectionEditorWrapper';
import {REFLECT} from 'universal/utils/constants';
import isTempId from 'universal/utils/relay/isTempId';

export type Props = {|
  // True when this card is being hovered over by a valid drag source
  hovered?: boolean,
  // True when the current user is the one dragging this card
  iAmDragging?: boolean,
  // Whether we're "collapsed" e.g. in a stack of cards.  This allows us to truncate to a constant height,
  // Simplifying style computations.
  isCollapsed?: boolean,
  // Provided by react-dnd
  isDragging?: boolean,
  // States whether it serves as a drag preview.
  pulled?: boolean,
  // The name of the user who is currently dragging this card to a new place, if any
  userDragging?: string,
  meeting: Meeting,
  reflection: Reflection,
  ...MutationProps
|};

type State = {
  content: string,
  editorState: EditorState,
  getEditorState: () => EditorState
};

type DnDStylesWrapperProps = {
  hovered?: boolean,
  pulled?: boolean,
  iAmDragging?: boolean
};

const BottomBar = styled('div')({
  alignItems: 'flex-start',
  color: appTheme.palette.mid,
  display: 'flex',
  fontSize: '0.9rem',
  justifyContent: 'space-between',
  padding: '0.4rem 0.8rem'
});

const DnDStylesWrapper = styled('div')(({pulled, iAmDragging}: DnDStylesWrapperProps) => ({
  opacity: ((iAmDragging && !pulled)) && 0.6
}));

class ReflectionCard extends Component<Props, State> {
  static getDerivedStateFromProps(nextProps: Props, prevState: State): $Shape<State> | null {
    const {reflection} = nextProps;
    const {content} = reflection;
    if (content === prevState.content) return null;
    const contentState = convertFromRaw(JSON.parse(content));
    return {
      content,
      editorState: EditorState.createWithContent(contentState, editorDecorators(prevState.getEditorState))
    };
  }

  state = {
    content: '',
    editorState: null,
    getEditorState: () => this.state.editorState
  };

  setEditorState = (editorState: EditorState) => {
    this.setState({editorState});
  };

  handleEditorBlur = () => {
    const {atmosphere, reflection: {reflectionId}} = this.props;
    if (isTempId(reflectionId)) return;
    this.handleContentUpdate();
    EditReflectionMutation(atmosphere, {isEditing: false, reflectionId});
  };

  handleEditorFocus = () => {
    const {atmosphere, reflection: {reflectionId}} = this.props;
    if (isTempId(reflectionId)) return;
    EditReflectionMutation(atmosphere, {isEditing: true, reflectionId});
  };

  handleContentUpdate = () => {
    const {atmosphere, meeting: {meetingId}, reflection: {content, reflectionId}, submitMutation, onError, onCompleted} = this.props;
    const {editorState} = this.state;
    if (!editorState) return;
    const contentState = editorState.getCurrentContent();
    if (contentState.hasText()) {
      const nextContent = JSON.stringify(convertToRaw(contentState));
      if (content === nextContent) return;
      submitMutation();
      UpdateReflectionContentMutation(atmosphere, {content: nextContent, reflectionId}, onError, onCompleted);
    } else {
      RemoveReflectionMutation(atmosphere, {reflectionId}, {meetingId}, onError, onCompleted);
    }
  };

  maybeRenderReflectionPhaseQuestion = () => {
    const {isCollapsed, reflection: {phaseItem: {question}}} = this.props;
    // TODO when to show?
    return false && !isCollapsed && <BottomBar>{question}</BottomBar>;
  };

  maybeRenderUserDragging = () => {
    const {isDragging, pulled, userDragging} = this.props;
    const styles = {
      color: appTheme.palette.warm,
      textAlign: 'end'
    };
    return (isDragging && !pulled) && (
      <div className={css(styles)}>
        {userDragging}
      </div>
    );
  };

  render() {
    const {hovered, iAmDragging, isCollapsed, pulled, userDragging, meeting, reflection} = this.props;
    const {editorState} = this.state;
    const {localPhase: {phaseType}, teamId} = meeting;
    const holdingPlace = Boolean(userDragging && !pulled);
    const {isViewerCreator} = reflection;
    const canDelete = isViewerCreator && phaseType === REFLECT;
    return (
      <DnDStylesWrapper pulled={pulled} iAmDragging={iAmDragging}>
        {this.maybeRenderUserDragging()}
        <ReflectionCardWrapper
          holdingPlace={holdingPlace}
          hoveringOver={hovered}
          pulled={pulled}
        >
          <ReflectionEditorWrapper
            ariaLabel="Edit this reflection"
            editorState={editorState}
            isCollapsed={isCollapsed}
            onBlur={this.handleEditorBlur}
            onFocus={this.handleEditorFocus}
            placeholder="My reflection thought..."
            readOnly={phaseType !== REFLECT}
            setEditorState={this.setEditorState}
            teamId={teamId}
          />
          {this.maybeRenderReflectionPhaseQuestion()}
          <ReflectionCardDeleteButton canDelete={canDelete} meeting={meeting} reflection={reflection} />
        </ReflectionCardWrapper>
      </DnDStylesWrapper>
    );
  }
}

reactLifecyclesCompat(ReflectionCard);

export default createFragmentContainer(
  withAtmosphere(withMutationProps(ReflectionCard)),
  graphql`
    fragment ReflectionCard_meeting on RetrospectiveMeeting {
      meetingId: id
      teamId
      localPhase {
        phaseType
      }
      ...ReflectionCardDeleteButton_meeting
    }
    fragment ReflectionCard_reflection on RetroReflection {
      reflectionId: id
      content
      isViewerCreator
      phaseItem {
        question
      }
      ...ReflectionCardDeleteButton_reflection
    }
  `
);
