import graphql from 'babel-plugin-relay/macro'
import Parser from 'json2csv/lib/JSON2CSVParser' // only grab the sync parser
import withAtmosphere, {
  WithAtmosphereProps
} from 'parabol-client/decorators/withAtmosphere/withAtmosphere'
import {PALETTE} from 'parabol-client/styles/paletteV2'
import extractTextFromDraftString from 'parabol-client/utils/draftjs/extractTextFromDraftString'
import withMutationProps, {WithMutationProps} from 'parabol-client/utils/relay/withMutationProps'
import {ExportToCSVQuery} from 'parabol-client/__generated__/ExportToCSVQuery.graphql'
import React, {Component} from 'react'
import {fetchQuery} from 'react-relay'
import emailDir from '../../emailDir'
import AnchorIfEmail from './MeetingSummaryEmail/AnchorIfEmail'
import EmailBorderBottom from './MeetingSummaryEmail/EmailBorderBottom'
import {MeetingSummaryReferrer} from './MeetingSummaryEmail/MeetingSummaryEmail'

interface Props extends WithAtmosphereProps, WithMutationProps {
  meetingId: string
  urlAction?: 'csv' | undefined
  emailCSVUrl: string
  referrer: MeetingSummaryReferrer
}

const query = graphql`
  query ExportToCSVQuery($meetingId: ID!) {
    viewer {
      newMeeting(meetingId: $meetingId) {
        meetingType
        team {
          name
        }
        endedAt
        ... on ActionMeeting {
          agendaItems {
            id
            content
            thread(first: 1000) {
              edges {
                node {
                  __typename
                  content
                  createdAt
                  createdByUser {
                    preferredName
                  }
                  replies {
                    content
                    createdAt
                    createdByUser {
                      preferredName
                    }
                  }
                }
              }
            }
          }
          meetingMembers {
            isCheckedIn
            tasks {
              content
              createdAt
              agendaItem {
                content
              }
            }
            user {
              preferredName
            }
          }
        }
        ... on RetrospectiveMeeting {
          reflectionGroups(sortBy: stageOrder) {
            id
            thread(first: 1000) {
              edges {
                node {
                  content
                  createdAt
                  createdByUser {
                    preferredName
                  }
                  replies {
                    content
                    createdAt
                    createdByUser {
                      preferredName
                    }
                  }
                }
              }
            }
            reflections {
              content
              createdAt
              phaseItem {
                question
              }
            }
            tasks {
              content
              createdAt
              createdByUser {
                preferredName
              }
            }
            title
            voteCount
          }
        }
      }
    }
  }
`

type Meeting = NonNullable<NonNullable<ExportToCSVQuery['response']['viewer']>['newMeeting']>

interface CSVRetroRow {
  title: string
  author: string
  votes: number
  prompt: string
  type: 'Task' | 'Reflection' | 'Comment' | 'Reply'
  createdAt: string
  replyTo: string
  content: string
}

interface CSVActionRow {
  author: string
  status: 'present' | 'absent'
  agendaItem: string
  type: 'Task' | 'Comment' | 'Reply'
  createdAt: string
  replyTo: string
  content: string
}

const label = 'Export to CSV'

const iconLinkLabel = {
  color: PALETTE.TEXT_MAIN,
  fontSize: '13px',
  paddingTop: 32
}

const labelStyle = {
  paddingLeft: 8
}
const imageStyle = {
  verticalAlign: 'middle'
}

class ExportToCSV extends Component<Props> {
  componentDidMount() {
    if (this.props.urlAction === 'csv') {
      this.exportToCSV().catch()
    }
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (this.props.urlAction === 'csv' && prevProps.urlAction !== 'csv') {
      this.exportToCSV().catch()
    }
  }

  handleRetroMeeting(newMeeting: Meeting) {
    const {reflectionGroups} = newMeeting

    const rows = [] as CSVRetroRow[]
    reflectionGroups!.forEach((group) => {
      const {reflections, tasks, title, voteCount: votes, thread} = group
      tasks.forEach((task) => {
        rows.push({
          title: title!,
          author: task!.createdByUser!.preferredName,
          votes,
          type: 'Task',
          createdAt: task.createdAt,
          replyTo: '',
          prompt: '',
          content: extractTextFromDraftString(task.content)
        })
      })
      reflections.forEach((reflection) => {
        rows.push({
          title: title!,
          author: 'anonymous',
          votes,
          type: 'Reflection',
          createdAt: reflection.createdAt!,
          replyTo: '',
          prompt: reflection.phaseItem.question,
          content: extractTextFromDraftString(reflection.content)
        })
      })
      thread.edges.forEach((edge) => {
        rows.push({
          title: title!,
          author: edge!.node!.createdByUser!.preferredName,
          votes,
          type: 'Comment',
          createdAt: edge.node.createdAt,
          replyTo: '',
          prompt: '',
          content: extractTextFromDraftString(edge.node.content)
        })
        edge.node.replies.forEach((reply) => {
          rows.push({
            title: title!,
            author: reply!.createdByUser!.preferredName,
            votes,
            type: 'Reply',
            createdAt: reply.createdAt,
            replyTo: extractTextFromDraftString(edge.node.content),
            prompt: '',
            content: extractTextFromDraftString(reply.content)
          })
        })
      })
    })
    return rows
  }

  handleActionMeeting(newMeeting: Meeting) {
    const {meetingMembers, agendaItems} = newMeeting

    const rows = [] as CSVActionRow[]
    meetingMembers!.forEach((meetingMember) => {
      const {isCheckedIn, tasks, user} = meetingMember
      const status = isCheckedIn ? 'present' : 'absent'
      const {preferredName} = user
      if (tasks.length === 0) {
        rows.push({
          author: preferredName,
          status,
          agendaItem: '',
          type: 'Task',
          createdAt: '',
          replyTo: '',
          content: ''
        })
        return
      }
      tasks.forEach((task) => {
        const {content, createdAt, agendaItem} = task
        rows.push({
          author: preferredName,
          status,
          agendaItem: agendaItem ? agendaItem.content : '',
          type: 'Task',
          createdAt: createdAt,
          replyTo: '',
          content: extractTextFromDraftString(content)
        })
      })
    })
    agendaItems!.forEach((agendaItem) => {
      const {thread} = agendaItem
      thread.edges.forEach((edge) => {
        if (edge.node.__typename !== 'Comment') return
        rows.push({
          author: edge!.node!.createdByUser!.preferredName,
          status: 'present',
          agendaItem: agendaItem ? agendaItem.content : '',
          type: 'Comment',
          createdAt: edge.node.createdAt,
          replyTo: '',
          content: extractTextFromDraftString(edge.node.content)
        })
        edge.node.replies.forEach((reply) => {
          rows.push({
            author: reply!.createdByUser!.preferredName,
            status: 'present',
            agendaItem: agendaItem ? agendaItem.content : '',
            type: 'Reply',
            createdAt: reply.createdAt,
            replyTo: extractTextFromDraftString(edge.node.content),
            content: extractTextFromDraftString(reply.content)
          })
        })
      })
    })
    return rows
  }

  getRows(newMeeting: Meeting) {
    switch (newMeeting.meetingType) {
      case 'action':
        return this.handleActionMeeting(newMeeting)
      case 'retrospective':
        return this.handleRetroMeeting(newMeeting)
    }
  }

  exportToCSV = async () => {
    const {atmosphere, meetingId, submitMutation, submitting, onCompleted} = this.props
    if (submitting) return
    submitMutation()
    const data = await fetchQuery<ExportToCSVQuery>(atmosphere, query, {meetingId})
    onCompleted()
    const {viewer} = data
    if (!viewer) return
    const {newMeeting} = viewer
    if (!newMeeting) return
    const rows = this.getRows(newMeeting)
    const {endedAt, team, meetingType} = newMeeting
    const {name: teamName} = team
    const label = meetingType[0].toUpperCase() + meetingType.slice(1)
    const parser = new Parser({withBOM: true})
    const csv = parser.parse(rows)
    const date = new Date(endedAt!)
    const numDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    // copied from https://stackoverflow.com/questions/18848860/javascript-array-to-csv/18849208#18849208
    // note: using encodeUri does NOT work on the # symbol & breaks
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'})
    const encodedUri = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Parabol${label}_${teamName}_${numDate}.csv`)
    document.body.appendChild(link) // Required for FF
    link.click()
    document.body.removeChild(link)
  }

  render() {
    const {emailCSVUrl, referrer} = this.props
    return (
      <>
        <tr>
          <td align='center' style={iconLinkLabel} width='100%'>
            <AnchorIfEmail isEmail={referrer === 'email'} href={emailCSVUrl} title={label}>
              <img
                crossOrigin=''
                alt={label}
                src={`${emailDir}cloud_download.png`}
                style={imageStyle}
              />
              <span style={labelStyle}>{label}</span>
            </AnchorIfEmail>
          </td>
        </tr>
        <EmailBorderBottom />
      </>
    )
  }
}

export default withAtmosphere(withMutationProps(ExportToCSV))
