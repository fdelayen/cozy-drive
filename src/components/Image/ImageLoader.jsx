/* global cozy */
import React from 'react'
import PropTypes from 'prop-types'
import logger from 'lib/logger'

const TTL = 10000

const PENDING = 'PENDING'
const LOADING_LINK = 'LOADING_LINK'
const LOADING_FALLBACK = 'LOADING_FALLBACK'
const LOADED = 'LOADED'
const FAILED = 'FAILED'

class ImageLoader extends React.Component {
  static contextTypes = {
    client: PropTypes.object.isRequired
  }

  state = {
    status: PENDING,
    src: null
  }

  _mounted = false

  componentDidMount() {
    this._mounted = true
    this.loadNextSrc()
  }

  componentWillUnmount() {
    this._mounted = false
    clearTimeout(this.timeout)
    if (this.img) {
      this.img.onload = this.img.onerror = null
      this.img.src = ''
    }
  }

  getFileId(file) {
    return file.id || file._id
  }

  loadNextSrc(lastError = null) {
    const { status } = this.state
    /**
     * If we know that the navigator is offline, don't try to loadLink.
     * */
    if (status === PENDING && window.navigator.onLine) this.loadLink()
    else if (status === LOADING_LINK) this.loadFallback()
    else if (status === LOADING_FALLBACK || !window.navigator.onLine) {
      logger.warn('failed loading thumbnail', lastError)
      this.setState({ status: FAILED })
      this.props.onError(lastError)
    }
  }

  checkImageSource(src) {
    const cleanImageLoader = () => {
      clearTimeout(this.timeout)
      this.img.onload = this.img.onerror = null
      this.img.src = ''
      this.img = null
    }

    return new Promise((resolve, reject) => {
      this.img = new Image()
      this.img.onload = resolve
      this.img.onerror = reject
      this.img.src = src
      this.timeout = setTimeout(
        () => reject(new Error('Loading image took too long')),
        TTL
      )
    }).then(cleanImageLoader, cleanImageLoader)
  }

  async getFileLinks(file) {
    if (file.links) return file.links
    else {
      const response = await cozy.client.files.statById(
        this.getFileId(file),
        false
      )
      if (!response.links) throw new Error('Could not fetch file links')
      return response.links
    }
  }

  async loadLink() {
    this.setState({ status: LOADING_LINK })
    const { file, size } = this.props
    const { client } = this.context

    try {
      const links = await this.getFileLinks(file, size)
      const link = links[size]

      if (!link) throw new Error(`${size} link is not available`)

      const src = client.options.uri + link
      await this.checkImageSource(src)
      if (this._mounted) {
        this.setState({
          status: LOADED,
          src
        })
      }
    } catch (e) {
      this.loadNextSrc(e)
    }
  }

  async loadFallback() {
    this.setState({ status: LOADING_FALLBACK })
    const { file } = this.props

    try {
      const src = await this.getDownloadLink(this.getFileId(file))
      await this.checkImageSource(src)
      if (this._mounted) {
        this.setState({
          status: LOADED,
          src
        })
      }
    } catch (e) {
      this.loadNextSrc(e)
    }
  }

  getDownloadLink(fileId) {
    return this.context.client
      ? this.context.client
          .collection('io.cozy.files')
          .getDownloadLinkById(fileId)
      : cozy.client.files
          .getDownloadLinkById(fileId)
          .then(path => `${cozy.client._url}${path}`)
  }

  render() {
    const { src } = this.state
    const { render, renderFallback } = this.props
    //If the navigator is not onLine, let's render the fallback directly
    if (src && window.navigator.onLine) return render(src)
    else if (renderFallback) return renderFallback()
    else return null
  }
}

ImageLoader.propTypes = {
  file: PropTypes.object.isRequired,
  render: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onError: PropTypes.func,
  renderFallback: PropTypes.func
}

ImageLoader.defaultProps = {
  size: 'small',
  onError: () => {}
}

export default ImageLoader
