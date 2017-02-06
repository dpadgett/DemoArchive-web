
function playerrpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'GET',
    url: 'playerrpc.php',
    data: alldata,
    dataType: 'json',
  }).done(callback);
}

function playerpostrpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'POST',
    url: 'playerrpc.php',
    data: alldata,
    dataType: 'json',
  }).done(callback);
}

function Q_IsColorString(str, idx)
{
  return str[idx] == '^' && str[idx + 1] != '^' && str[idx + 1] <= '9' && str[idx + 1] >= '0';
}
function Q_CleanStr(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else if (str.charCodeAt(idx) >= 0x20 && str.charCodeAt(idx) <= 0x7E) {
      dest += str[idx];
    }
  }
  return dest;
}
function strip_colors(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else {
      dest += str[idx];
    }
  }
  return dest;
}
function matchColorInsensitive(values) {
  return function( request, response ) {
    var matcher = new RegExp( $.ui.autocomplete.escapeRegex( request.term ), "i" );
    response( $.grep( values, function( value ) {
      value = value.label || value.value || value;
      return matcher.test( value ) || matcher.test( strip_colors( value ) );
    }) );
  };
}

function colorToHex(color)
{
  return sprintf("%02X%02X%02X",
      parseInt(color[0] * 255 * 0.75),
      parseInt(color[1] * 255 * 0.75),
      parseInt(color[2] * 255 * 0.75));
}

function colorize(str) {
  var g_color_table = [
    [0, 0, 0, 1],			// CT_BLACK
    [1, 0, 0, 1],			// CT_RED
    [0, 1, 0, 1],			// CT_GREEN
    [1, 1, 0, 1],			// CT_YELLOW
    [0, 0, 1, 1],			// CT_BLUE
    [0, 1, 1, 1],			// CT_CYAN
    [1, 0, 1, 1],			// CT_MAGENTA
    [1, 1, 1, 1],			// CT_WHITE
  ];

  var def = g_color_table[0];
  // draw the colored text
  var out = '<span style="color:#"' + colorToHex(def) + '">';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      var color = parseInt(str[idx + 1]);
      if (color > 7 || color < 0) {
        color = 0;
      }
      out += '</span><span style="color:#' + colorToHex(g_color_table[parseInt(color) % g_color_table.length]) + '">';
      idx++;
      continue;
    }
    out += str[idx];
  }
  out += '</span>';

  return out;
}

function search(offset, limit)
{
  var data = { 'offset': offset, 'limit': limit };
  var player = $('input[name="player"]').val();
  if (player != '') {
    data['name'] = player;
  }
  var hashdata = $.extend({'rpc': 'search'}, data);
  window.location.hash = $.param(hashdata);
  playerrpc('searchplayers', data, function(response) {
    $('#searchresult').text('Results');
    $('#topplayers').find('tr:gt(0)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writePlayerRow(response.result[idx], offset);
    }
    writePagination(search, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

function getMergeIds() {
  var ids = [];
  $('input.merge').each(function(idx, checkbox) {
    checkbox = $(checkbox);
    if (checkbox.prop('checked')) {
      ids.push(checkbox.attr('name'));
    }
  });
  return ids;
}

function updateMergeButton() {
  var enabled = getMergeIds().length > 1;
  $('#mergebutton').prop('disabled', !enabled);
}

function checkAllMergeBoxes() {
  $('input.merge').prop('checked', $('#mergeall').prop('checked'));
  updateMergeButton();
}

function mergePlayers() {
  $('#mergebutton').prop('disabled', true);
  var ids = getMergeIds();
  if (ids.length < 2) {
    console.log('Not enough ids!');
    return;
  }
  playerpostrpc('mergeplayers', {'ids': ids}, function(response) {
    console.log(response);
    var hashRendered = false;
    if (window.location.hash) {
      var hashdata = $.deparam.fragment($.param.fragment(), true);
      var rpcname = hashdata['rpc'];
      hashRendered = true;
      if (rpcname == 'search') {
        if ('name' in hashdata) {
          $('input[name="player"]').val(hashdata['name']);
        }
        search(hashdata['offset'], hashdata['limit']);
      } else if (rpcname == 'topPlayers') {
        topPlayers(hashdata['offset'], hashdata['limit']);
      } else {
        hashRendered = false;
      }
    }
    if (!hashRendered) {
      location.reload();
    }
  });
}

function writePlayerRow(player, offset)
{
  var rating = "";
  if ('rating' in player && 'friendly' in player['rating']) {
    rating = Math.floor(player['rating']['friendly'] * 100);
  }
  var cells = [
    colorize(player['name']) + " (" + player['name'] + ")",
    rating,
    moment.duration(player['time']).humanize(),
    player.num_matches,
  ];

  var row = $('<tr>');
  var checkboxCell = $('<td>');
  checkboxCell.attr('class', 'merge');
  var checkbox = $('<input>');
  checkboxCell.append(checkbox);
  checkbox.attr('type', 'checkbox');
  checkbox.attr('class', 'merge');
  checkbox.attr('name', player['_id']['$id']);
  checkbox.click(updateMergeButton);
  var playerLinkCell = $('<td>');
  var playerLink = $('<a>Link</a>');
  playerLink.attr('href', 'aplayer.html#id=' + player['_id']['$id']);
  console.log(player);
  playerLinkCell.append(playerLink);
  row.append(checkboxCell);
  row.append(playerLinkCell);
  $.each(cells, function(idx, cell) {
    row.append($('<td>' + cell + '</td>'));
  });
  $('#topplayers tr:last').after(row);
  return offset;
}

function writePagination(rpc, count, curOffset, limit)
{
  curOffset -= curOffset % limit;
  if (typeof count === 'undefined' || isNaN(count)) {
    count = curOffset + limit;
  }
  //console.log("pagingation for " + count + ", " + curOffset + ", " + limit);
  var linkOffsets = [];
  // 4 links on each side: [0][1][2] [...] [3][*4*][5] [...] [6][7][8]
  // left side
  var numLinks = 0;
  var offset = 0;
  for (; offset < curOffset - limit && numLinks < 3; offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  if (offset < curOffset - limit) {
    linkOffsets.push(-1);
    offset = Math.max(0, curOffset - limit);
  }
  for (; offset < count && offset <= curOffset + limit; offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  var remainingLinks = 8 - numLinks;
  var minOffset = (count - (count % limit)) - remainingLinks * limit;
  if (offset < minOffset) {
    linkOffsets.push(-1);
    offset = Math.max(offset, minOffset);
  }
  for (; offset < count; offset += limit) {
    linkOffsets.push(offset);
  }
  $('span#page').find('a').remove();
  for (var idx = 0; idx < linkOffsets.length; idx++) {
    var offset = linkOffsets[idx];
    if (offset == -1) {
      var node = $('<a></a>').text(' ... ');
    } else {
      var node = $('<a>[' + offset + '-' + Math.min(count, offset + limit - 1) + ']</a>');
      if (offset <= curOffset && offset + limit > curOffset) {
        // not a link
      } else {
        node.attr('href', '#');
        var f = function() {
          var offset_ = offset;
          var limit_ = limit;
          node.click(function(e) {
            e.preventDefault();
            rpc(offset_, limit_);
            return false;
          });
        }();
      }
    }
    $('span#page').append(node);
  }
  // hack to put it here
  $('#mergeall').prop('checked', false);
  checkAllMergeBoxes();
}

function topPlayers(offset, limit)
{
  var hashdata = {'rpc': 'topPlayers', 'offset': offset, 'limit': limit};
  window.location.hash = $.param(hashdata);
  var data = { 'offset': offset, 'limit': limit };
  playerrpc('topplayers', data, function(response) {
    $('#searchresult').text('Top players:');
    $('#topplayers').find('tr:gt(0)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writePlayerRow(response.result[idx], true, offset);
    }
    writePagination(topPlayers, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

$(document).ready(function()
{
  if (checkmerge) {
    $('#merge').text('');
  }
  $('form#search').attr('onSubmit', 'search(0, 50); return false;');
  $('#mergeall').click(checkAllMergeBoxes);
  $('#mergebutton').click(mergePlayers);
  var header = $('#topplayers').find('tr:eq(0)');
  var tds = $($('#topplayers').find('tr:eq(0)')[0]).find('td');
  // for initializing elements on the page, the rpcs should be done on page load as jsonp instead of async
  $('#numdemos').text('' + numdemos['numdemos']);
  // check if we should be loading the data via hash instead of the default data
  var hashRendered = false;
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), true);
    var rpcname = hashdata['rpc'];
    hashRendered = true;
    if (rpcname == 'search') {
      if ('name' in hashdata) {
        $('input[name="player"]').val(hashdata['name']);
      }
      search(hashdata['offset'], hashdata['limit']);
    } else if (rpcname == 'topPlayers') {
      topPlayers(hashdata['offset'], hashdata['limit']);
    } else {
      hashRendered = false;
    }
  }
  if (!hashRendered) {
    var offset = 0;
    for (var idx = 0; idx < topplayers.result.length; idx++) {
      offset = writePlayerRow(topplayers.result[idx], true, offset);
    }
    writePagination(topPlayers, parseInt(topplayers.total), parseInt(topplayers.offset), parseInt(topplayers.limit));
  }
})
