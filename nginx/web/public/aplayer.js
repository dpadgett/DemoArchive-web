
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

function lookup(id)
{
  var data = { 'id': id };
  var hashdata = $.extend({'rpc': 'lookup'}, data);
  window.location.hash = $.param(hashdata);
  rpc('lookupmatch', data, function(response) {
    $('#searchresult').text('Results');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], false, offset);
    }
    // removes any pagination
    $('span#page').find('a').remove();
  });
}

function writePlayerRow(player, offset)
{
  var names = [];
  var ips = [];
  var guids = [];
  var matches = [];
  var cells = [
    colorize(player['name']),
    "<a href=\"match.html#rpc=lookup&id=" + player['last_match'] + "\">" + player['last_match'] + "</a>",
    moment.duration(player['time']).humanize(),
  ];

  var row = $('<tr>');
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

var playerApp = angular.module('playerApp', []);

var player = {'name': 'Loading...', 'matches': [], 'names': []};

playerApp.controller('PlayerCtrl', function ($scope, $http, $sce) {
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), true);
    $http.get('playerrpc.php?rpc=lookup&id=' + hashdata['id']).success(function(data) {
      var player = data.result[0];
      $.each(player.names, function(idx, name) {
        name.rawname = name.name;
        name.name = $sce.trustAsHtml(colorize(name.name)/* + " (" + name.name + ")"*/);
        name.time = moment.duration(name.time).humanize();
      });
      $.each(player.matches, function(idx, match) {
        $.each(match.names, function(idx, name) {
          name.rawname = name.name;
          name.name = $sce.trustAsHtml(colorize(name.name));
        });
        if ('rating' in match) {
          match.rating.start.friendly *= 100;
          match.rating.start.friendly = Math.floor(match.rating.start.friendly);

          match.rating.updated.friendly *= 100;
          match.rating.updated.friendly = Math.floor(match.rating.updated.friendly);
        }
        match.time = moment(match.time.sec * 1000).format("YYYY-MM-DD hh:mm:ss a");
      });
      player.matches.reverse();
      if ('rating' in player && 'friendly' in player.rating) {
        player.rating.friendly *= 100;
        player.rating.friendly = Math.floor(player.rating.friendly);
      }
      $scope.player = player;
    });
  }
  $scope.player = player;
});

function mergePlayers() {
  if (!window.location.hash) {
    return;
  }
  var hashdata = $.deparam.fragment($.param.fragment(), true);
  ids = [hashdata['id'], $('#mergeid').val()];
  console.log(ids);
  playerpostrpc('mergeplayers', {'ids': ids}, function(response) {
    console.log(response);
    location.reload();
  });
}

$(document).ready(function()
{
  if (checkmerge) {
    window.location = 'debugplayer.html' + window.location.hash;
  }
  // for initializing elements on the page, the rpcs should be done on page load as jsonp instead of async
  $('#numdemos').text('' + numdemos['numdemos']);
  // check if we should be loading the data via hash instead of the default data
  /*var hashRendered = false;
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), true);
    var id = hashdata['id'];
    hashRendered = true;
    playerrpc('lookup', hashdata, function(response) {
      player = response;
    });
  }
  if (!hashRendered) {
    player = {'name': 'No id specified!', 'matches': [], 'names': []};
  }*/
})
